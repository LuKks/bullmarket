const EventEmitter = require('events')
const fetch = require('like-fetch')
const setCookie = require('set-cookie-parser')
const cookie = require('cookie')
const FormData = require('form-data')
const WebSocket = require('ws')

const API_URL = 'https://www.bullmarketbrokers.com'
const HUB_URL = 'https://hub.bullmarketbrokers.com'
const WS_URL = 'wss://hub.bullmarketbrokers.com'
const SEP = '\x1e'

module.exports = class BullMarket {
  constructor (opts = {}) {
    this.email = opts.email
    this.password = opts.password
    this.fingerprint = opts.fingerprint // Get your verified fingerprint by inspecting elements at /Security/SignIn

    this.userAgent = opts.userAgent || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    this.session = opts.session || null

    this.hub = new Hub()
  }

  async login () {
    const response = await fetch(API_URL + '/Security/SignIn', {
      method: 'GET',
      headers: {
        Origin: API_URL,
        'User-Agent': this.userAgent
      }
    })

    const cookies = getCookies(response)
    const forgeryKey = Object.keys(cookies).find(name => name.startsWith('.AspNetCore.Antiforgery'))

    if (!cookies.BullMarketGroup || !cookies[forgeryKey]) {
      throw new Error('Invalid credentials (first step)')
    }

    const html = await response.text()
    const form = html.match(/<input name="__RequestVerificationToken" type="hidden" value="(.*?)"/i)
    const __RequestVerificationToken = form ? form[1] : null

    const response2 = await fetch(API_URL + '/Security/SignIn', {
      method: 'POST',
      headers: {
        Origin: API_URL,
        'User-Agent': this.userAgent,
        Cookie: serializeCookies(cookies)
      },
      requestType: 'url',
      body: {
        __RequestVerificationToken,
        FingerPrint: this.fingerprint,
        Email: this.email,
        Password: this.password
      },
      redirect: 'manual'
    })

    if (response2.status !== 302) throw new Error('Invalid credentials or unknown error (status: ' + response2.status + ')')

    const location = response2.headers.get('location') || ''
    if (location.includes('/Home/Error/')) throw new Error('Unknown error')
    else if (location.endsWith('/Security/SignIn/WithOtp')) throw new Error('OTP is required (wrong fingerprint)')

    const cookies2 = getCookies(response2)

    if (!cookies2.BMB || !cookies2['.AspNetCore.Session']) {
      throw new Error('Invalid credentials (second step)')
    }

    this.session = {
      ...cookies,
      ...cookies2
    }
  }

  async logout () {
    const session = this.session
    this.session = null

    await this.api('/Security/SignIn/Logout', {
      method: 'GET',
      headers: {
        Cookie: serializeCookies(session)
      }
    })

    await this.hub.disconnect()
  }

  // TODO: isVerified () {}

  async getStockAccounts () {
    return this.api('/home/GetStockAccountsForDropdown')
  }

  async setStockAccount (stockAccountNumber) {
    return this.api('/Home/SetStockAccountJson?stockAccountNumber=' + stockAccountNumber)
  }

  async getScreen (stockAccountNumber) {
    return this.api('/Operations/StockAccountQueries/GetScreen?stockAccountNumber=' + stockAccountNumber)
  }

  async getOrders (stockAccountNumber) {
    return this.api('/Operations/orders/GetOrders?stockAccountNumber=' + stockAccountNumber + '&onlyPending=true')
  }

  async getDollarsPrice () {
    return this.api('/Information/StockPrice/GetDollarsPrice')
  }

  async getStockPrices (index, term) {
    index = index.replace(/\s/g, '+').toLowerCase() // => 'merval', 'panel general', 'opciones', 'bonos', 'cedears', 'cauciones'
    term = index === 'cauciones' ? '' : term

    return this.api('/Information/StockPrice/GetStockPrices?_ts=' + Date.now() + '&term=' + encodeTerm(term) + '&index=' + index + '&sortColumn=ticker&isAscending=true')
  }

  async initializeStockPrice (symbol, term) {
    return this.api('/Operations/Orders/InitializeStockPrice?symbol=' + symbol + '&term=' + encodeTerm(term))
  }

  async getStockPrice (symbols, term) {
    const form = new FormData()

    for (let i = 0; i < symbols.length; i++) {
      if (!symbols[i].term) throw new Error('Must set a term (ci or 48hs)')

      form.append('stockPrices[' + i + '].ticker', symbols[i].symbol)
      form.append('stockPrices[' + i + '].term', encodeTerm(symbols[i].term))
    }

    return this.api('/Information/StockPrice/GetStockPrice', {
      method: 'POST',
      requestType: 'form',
      body: form
    })
  }

  async getAccountBalance (stockAccountNumber, opts = {}) {
    const page = opts.page || 1
    const ascending = opts.ascending || false

    return this.api('/Clients/AccountBalance/GetAccountBalance?sortColumn=orderColumn&isAscending=' + ascending + '&currency=PESOS&stockAccountNumber=' + stockAccountNumber + '&searchDateStart=&searchDateEnd=&PageSize=20&page=' + page)
  }

  async getStockDescription (symbol) {
    return this.api('/Information/StockData/getStockDescription?symbol=' + symbol)
  }

  async tradingTime () {
    return this.api('/Information/TradingView/time')
  }

  async tradingHistory (symbol, opts = {}) {
    return this.api('/Information/TradingView/history?symbol=' + symbol + '&resolution=D&from=' + opts.from + '&to=' + opts.to)
  }

  // TODO: /Operations/Orders/FixOrder
  // TODO: /Home/GetCurrentUserSiteNotifications

  async api (pathname, opts = {}) {
    const response = await fetch(API_URL + pathname, {
      method: opts.method || 'POST',
      headers: {
        Cookie: serializeCookies(this.session),
        ...opts.headers
      },
      requestType: opts.requestType,
      body: opts.body,
      redirect: 'manual'
    })

    const contentType = response.headers.get('content-type') || ''
    const contentLength = response.headers.get('content-length')

    // For now checking for text due logout API, probably make a contentType option or something to return the response
    const isHTML = contentType.includes('text/html')
    if (isHTML) return response.text()

    // getStockPrices: While being unlogged returns no Content-Type header
    if (!contentType) return null

    // getStockAccounts: If account is not "verified" returns Content-Length with zero value
    if (contentLength !== null && contentLength === 0) return null

    return response.json()
  }
}

class Hub extends EventEmitter {
  constructor () {
    super()

    this.ws = null

    this._onopen = this._onopen.bind(this)
    this._onmessage = this._onmessage.bind(this)
    this._onclose = this._onclose.bind(this)
    this._onerror = this._onerror.bind(this)

    this._keepAlive = null
    this._onkeepalive = this._onkeepalive.bind(this)

    this._invocationId = -1

    this._connecting = null
    this._disconnecting = null
    this._connected = false
  }

  async negotiate () {
    const response = await fetch(HUB_URL + '/stock-prices-hub/negotiate?token=00000000-0000-0000-0000-000000000000&negotiateVersion=1', {
      method: 'POST',
      headers: {
        'X-Signalr-User-Agent': 'Microsoft SignalR/5.0 (5.0.8; Unknown OS; Browser; Unknown Runtime Version)'
      }
    })
    return response.json()
  }

  async connect (info) {
    if (this._connecting) return this._connecting
    this._connecting = this._connect(info)
    return this._connecting
  }

  async disconnect () {
    if (this._disconnecting) return this._disconnecting
    this._disconnecting = this._disconnect()
    return this._disconnecting
  }

  async _connect (info) {
    if (this._connected === true && this._disconnecting !== null) await this._disconnecting

    if (!info) info = await this.negotiate()

    this._invocationId = 0

    this.ws = new WebSocket(WS_URL + '/stock-prices-hub?token=00000000-0000-0000-0000-000000000000&id=' + info.connectionToken, {
      origin: API_URL
    })

    this.ws.on('open', this._onopen)
    this.ws.on('message', this._onmessage)
    this.ws.on('close', this._onclose)
    this.ws.on('error', this._onerror)

    await waitForWebSocket(this.ws)

    this.send({ protocol: 'json', version: 1 })

    await this._waitForMessage(msg => !msg.type)

    this._keepAlive = setInterval(this._onkeepalive, 15000)

    this._connected = true
    this._connecting = null
    this._disconnecting = null
  }

  async _disconnect () {
    if (this._connected === false && this._connecting !== null) await this._connecting

    if (this.ws) {
      if (this.ws.readyState === 0) await waitForWebSocket(this.ws)
      if (this.ws.readyState === 1) this.ws.close()
      if (this.ws.readyState === 2) await new Promise(resolve => this.ws.once('close', resolve))
    }

    this._connected = false
    this._connecting = null
  }

  _onopen () {
  }

  _onmessage (msg) {
    // ACK:
    // No type = Connected
    // Type 3 = Invocation
    // Type 6 = Keep alive
    // Type 7 = Closed with error

    const messages = msg.toString().split(SEP)

    for (const message of messages) {
      if (!message) return

      this.emit('message', JSON.parse(message))
    }
  }

  _onerror (err) {
    this.emit('error', err)
  }

  _onclose () {
    this._clearKeepAlive()

    this.ws.removeListener('open', this._onopen)
    this.ws.removeListener('message', this._onmessage)
    this.ws.removeListener('close', this._onclose)
    this.ws.removeListener('error', this._onerror)
  }

  send (data) {
    if (this.ws.readyState !== 1) throw new Error('Hub is not connected')

    this.ws.send(JSON.stringify(data) + SEP)
  }

  _onkeepalive () {
    try {
      this.send({ type: 6 })
    } catch {}
  }

  _clearKeepAlive () {
    if (this._keepAlive === null) return

    clearInterval(this._keepAlive)
    this._keepAlive = null
  }

  async joinStockPriceChange (name, term) {
    const invocationId = (this._invocationId++).toString()

    this.send({
      arguments: [name, encodeTerm(term).toString()],
      invocationId,
      target: 'JoinStockPriceChange',
      type: 1
    })

    return this._waitForInvocation(invocationId)
  }

  _waitForInvocation (invocationId) {
    return this._waitForMessage(msg => msg.type === 3 && msg.invocationId === invocationId)
  }

  _waitForMessage (cb) {
    return new Promise((resolve, reject) => {
      const ws = this.ws

      const cleanup = () => {
        this.removeListener('message', onmessage)
        ws.removeListener('close', onclose)
      }

      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error('ACK timed out'))
      }, 15000)

      const onmessage = (msg) => {
        if (!cb(msg)) return

        clearTimeout(timeout)
        cleanup()
        resolve()
      }

      const onclose = () => {
        clearTimeout(timeout)
        cleanup()
        reject(new Error('Connection destroyed'))
      }

      this.on('message', onmessage)
      ws.on('close', onclose)
    })
  }
}

function encodeTerm (term) {
  if (!term) return ''
  return term === 'ci' ? 1 : 3
}

function waitForWebSocket (ws) {
  return new Promise((resolve, reject) => {
    ws.on('open', onopen)
    ws.on('close', onclose)
    ws.on('error', onerror)

    function onopen () {
      cleanup()
      resolve()
    }

    function onclose () {
      cleanup()
      reject(new Error('Socket closed'))
    }

    function onerror (err) {
      cleanup()
      reject(err)
    }

    function cleanup () {
      ws.removeListener('open', onopen)
      ws.removeListener('close', onclose)
      ws.removeListener('error', onerror)
    }
  })
}

function getCookies (response) {
  const headerSetCookie = response.headers.get('set-cookie')
  const splitCookieHeaders = setCookie.splitCookiesString(headerSetCookie)
  return setCookie.parse(splitCookieHeaders, { map: true })
}

function serializeCookies (cookies) {
  if (!cookies) return ''
  const arr = []
  for (const k in cookies) {
    const c = cookies[k]
    arr.push(cookie.serialize(c.name, c.value))
  }
  return arr.join('; ')
}
