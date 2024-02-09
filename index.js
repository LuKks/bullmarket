const fetch = require('like-fetch')
const setCookie = require('set-cookie-parser')
const cookie = require('cookie')

const API_URL = 'https://www.bullmarketbrokers.com'

module.exports = class BullMarket {
  constructor (opts = {}) {
    this.email = opts.email
    this.password = opts.password
    this.fingerprint = opts.fingerprint // Get your verified fingerprint by inspecting elements at /Security/SignIn

    this.userAgent = opts.userAgent || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    this.session = opts.session || null
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
    term = index === 'cauciones' ? '' : (term === 'ci' ? 1 : 3) // => 'ci', '48hs'

    return this.api('/Information/StockPrice/GetStockPrices?_ts=' + Date.now() + '&term=' + term + '&index=' + index + '&sortColumn=ticker&isAscending=true')
  }

  async getAccountBalance (stockAccountNumber, opts = {}) {
    const page = opts.page || 1
    const ascending = opts.ascending || false

    return this.api('/Clients/AccountBalance/GetAccountBalance?sortColumn=orderColumn&isAscending=' + ascending + '&currency=PESOS&stockAccountNumber=' + stockAccountNumber + '&searchDateStart=&searchDateEnd=&PageSize=20&page=' + page)
  }

  async GetStockDescription (symbol) {
    return this.api('/Information/StockData/GetStockDescription?symbol=' + symbol)
  }

  // TODO: /Operations/Orders/FixOrder
  // TODO: /stock-prices-hub/negotiate
  // TODO: /Information/StockPrice/GetStockPrice
  // TODO: wss://hub.bullmarketbrokers.com/stock-prices-hub
  // TODO: /Home/GetCurrentUserSiteNotifications

  async api (pathname, opts = {}) {
    const response = await fetch(API_URL + pathname, {
      method: opts.method || 'POST',
      headers: {
        Cookie: serializeCookies(this.session),
        ...opts.headers
      },
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
