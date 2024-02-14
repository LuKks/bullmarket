const test = require('brittle')
const BullMarket = require('./index.js')

if (!process.env.EMAIL || !process.env.PASSWORD || !process.env.FINGERPRINT) {
  console.error('You have to pass all the ENV variables like this:')
  console.error('EMAIL="email@gmail.com" PASSWORD="1234" FINGERPRINT="abcd1234b4c0d1dc9d60e824b3cb71c0" npm run test')
  process.exit(1)
}

test('login', async function (t) {
  t.plan(5)

  const broker = new BullMarket({
    email: process.env.EMAIL,
    password: process.env.PASSWORD,
    fingerprint: process.env.FINGERPRINT
  })

  t.is(broker.session, null)

  await broker.login()

  const forgeryKey = Object.keys(broker.session).find(name => name.startsWith('.AspNetCore.Antiforgery'))

  t.ok(broker.session.BullMarketGroup)
  t.ok(broker.session[forgeryKey])
  t.ok(broker.session.BMB)
  t.ok(broker.session['.AspNetCore.Session'])
})

test('logout', async function (t) {
  t.plan(4)

  const broker = new BullMarket({
    email: process.env.EMAIL,
    password: process.env.PASSWORD,
    fingerprint: process.env.FINGERPRINT
  })

  await broker.login()
  // const saved = broker.session

  t.ok(await broker.getStockAccounts())
  t.ok(await broker.getStockPrices('merval', 'ci'))

  await broker.logout()
  // broker.session = saved // TODO: Their server doesn't actually revokes the old session, it just clears the cookies

  t.is(await broker.getStockAccounts(), null)
  t.is(await broker.getStockPrices('merval', 'ci'), null)
})

test('get stock accounts', async function (t) {
  t.plan(6)

  const broker = new BullMarket({
    email: process.env.EMAIL,
    password: process.env.PASSWORD,
    fingerprint: process.env.FINGERPRINT
  })

  await broker.login()

  const stockAccounts = await broker.getStockAccounts()

  t.ok(Array.isArray(stockAccounts))

  for (const stockAccount of stockAccounts) {
    t.alike(Object.keys(stockAccount), ['id', 'text', 'selected', 'number'])

    t.is(typeof stockAccount.id, 'number')
    t.is(typeof stockAccount.text, 'string')
    t.is(typeof stockAccount.selected, 'boolean')
    t.is(typeof stockAccount.number, 'number')
  }
})

test('set stock account', async function (t) {
  const broker = new BullMarket({
    email: process.env.EMAIL,
    password: process.env.PASSWORD,
    fingerprint: process.env.FINGERPRINT
  })

  await broker.login()

  const stockAccounts = await broker.getStockAccounts()

  t.is(await broker.setStockAccount(stockAccounts[0].number), true)

  // Note: It should set the stock account before using getScreen and other APIs but still work without it
})

test('get screen', async function (t) {
  const broker = new BullMarket({
    email: process.env.EMAIL,
    password: process.env.PASSWORD,
    fingerprint: process.env.FINGERPRINT
  })

  await broker.login()

  const stockAccounts = await broker.getStockAccounts()
  const screen = await broker.getScreen(stockAccounts[0].number)

  t.alike(Object.keys(screen), ['screen', 'accountStatus'])
  t.alike(Object.keys(screen.screen), ['assets', 'account', 'buyingPower', 'dollarCompromisedToWithdrawal', 'buyingPowerRofex', 'totalAccount', 'creationDate'])
  t.alike(Object.keys(screen.accountStatus), ['isMarcada', 'isDisabled', 'isRestricted', 'seenDisabledMessage', 'isProvisory', 'isBeingRemoved'])

  t.ok(Array.isArray(screen.screen.assets))
  t.is(screen.screen.account, stockAccounts[0].number)
  t.ok(screen.screen.buyingPower) // => { '0': 1234.890, '1': 471.37, '2': 1234.890, '3': 1234.890 }
  t.is(typeof screen.screen.dollarCompromisedToWithdrawal, 'number')
  t.is(typeof screen.screen.buyingPowerRofex, 'number')
  t.is(typeof screen.screen.totalAccount, 'number')
  t.is(typeof screen.screen.creationDate, 'string')

  // screen.screen.assets[0]

  /* => {
    symbol: 'DOLARES',
    currency: 'USD',
    price: 679.2395093265213,
    multiplier: 1,
    closePrice: 0,
    variation: 0,
    detailedQuantity: [
      {
        settleType: 1,
        quantity: 0,
        availableQuantity: 0,
        variation: 0,
        settleDate: '2023-09-05T00:00:00-03:00',
        compromised: 0
      }
    ],
    compromisedQuantities: [],
    detailWarranties: [],
    settleQuantity: 0,
    marginRatio: 1,
    warningAmount: 0,
    amount: 0,
    strategyAmount: 0,
    closeAmount: 0,
    earnings: 0,
    warrantyAmount: 0,
    settleAmount: 0,
    aforoRofex: 1,
    inRofexWarranty: 0
  } */

  /* => {
    symbol: 'AAL',
    securityExchange: 'CD',
    name: 'CEDEAR AMERICAN AIRLINES GROUP INC',
    currency: 'ARS',
    price: 5610,
    multiplier: 1,
    closePrice: 0,
    variation: 0,
    detailedQuantity: [ {
      settleType: 1,
      quantity: 20,
      availableQuantity: 20,
      variation: 20,
      settleDate: '0001-01-01T00:00:00',
      compromised: 0
    } ],
    compromisedQuantities: [],
    detailWarranties: [],
    settleQuantity: 0,
    market: 'BYMA',
    marginRatio: 0.2,
    warningAmount: 0,
    amount: 112200,
    strategyAmount: 0,
    closeAmount: 0,
    earnings: 0,
    warrantyAmount: 0,
    settleAmount: 0,
    buyAveragePrice: 2967.10300001,
    aforoRofex: 0,
    inRofexWarranty: 0
  } */
})

test('get orders', async function (t) {
  const broker = new BullMarket({
    email: process.env.EMAIL,
    password: process.env.PASSWORD,
    fingerprint: process.env.FINGERPRINT
  })

  await broker.login()

  const stockAccounts = await broker.getStockAccounts()
  const orders = await broker.getOrders(stockAccounts[0].number)

  t.ok(Array.isArray(orders))

  // TODO: Should create a limit order to see what it looks like
})

test('get dollars price', async function (t) {
  const broker = new BullMarket({
    email: process.env.EMAIL,
    password: process.env.PASSWORD,
    fingerprint: process.env.FINGERPRINT
  })

  await broker.login()

  const dollars = await broker.getDollarsPrice()

  // It might contain more like dollarMepCI, dollarCableCI, dollarMepRestriccionesCI, etc
  const expected = ['dollarMep', 'dollarCable', 'dollarMepRestricciones', 'dollarCableRestricciones', 'dollarSenebi', 'dollarSenebiCable']

  for (const name of expected) {
    const dollar = dollars[name]

    t.alike(Object.keys(dollar), ['lastUpdate', 'askPrice', 'bidPrice', 'askDollarPriceDetail', 'bidDollarPriceDetail'])
    t.alike(Object.keys(dollar.askDollarPriceDetail), ['bidDate', 'askDate', 'askPrice', 'bidPrice'])
    t.alike(Object.keys(dollar.bidDollarPriceDetail), ['bidDate', 'askDate', 'askPrice', 'bidPrice'])

    t.is(typeof dollar.lastUpdate, 'string')
    t.is(typeof dollar.askPrice, 'number')
    t.is(typeof dollar.bidPrice, 'number')
    t.is(typeof dollar.askDollarPriceDetail.bidDate, 'string')
    t.is(typeof dollar.askDollarPriceDetail.askDate, 'string')
    t.is(typeof dollar.askDollarPriceDetail.askPrice, 'number')
    t.is(typeof dollar.askDollarPriceDetail.bidPrice, 'number')
    t.is(typeof dollar.bidDollarPriceDetail.bidDate, 'string')
    t.is(typeof dollar.bidDollarPriceDetail.askDate, 'string')
    t.is(typeof dollar.bidDollarPriceDetail.askPrice, 'number')
    t.is(typeof dollar.bidDollarPriceDetail.bidPrice, 'number')
  }
})

test('get stock prices', async function (t) {
  const broker = new BullMarket({
    email: process.env.EMAIL,
    password: process.env.PASSWORD,
    fingerprint: process.env.FINGERPRINT
  })

  await broker.login()

  const stocks = await broker.getStockPrices('merval', 'ci')

  t.ok(Object.keys(stocks), ['result', 'isBond'])

  t.ok(Array.isArray(stocks.result))

  /* => [{
    ticker: 'ALUA',
    indexes: [Array],
    stockOffer: [Object],
    stockState: [Object],
    emisionDate: 20230818,
    emisionTime: '173523',
    change: false,
    date: '2023-08-18T17:35:23.6001166-03:00',
    executionMonthOrder: 0,
    strikePrice: 0,
    term: '1',
    hasInformation: [Object],
    isOption: false,
    mayorista: 0
  }, ...] */
})

test('initialize stock price', async function (t) {
  const broker = new BullMarket({
    email: process.env.EMAIL,
    password: process.env.PASSWORD,
    fingerprint: process.env.FINGERPRINT
  })

  await broker.login()

  const stock = await broker.initializeStockPrice('AAPL', '48hs')

  t.alike(Object.keys(stock), [
    'metadataTrace', 'fixNumber', 'idFixNumbers', 'indexes',
    'date', 'stockState', 'stockOffer', 'change',
    'priceChanged', 'expirationDate', 'ticker', 'term',
    'emisionTime', 'emisionDate', 'strikePrice', 'executionMonthOrder'
  ])

  t.alike(Object.keys(stock.stockState), [
    'open', 'min', 'max', 'price',
    'totalNominalValue', 'totalAmount', 'operations', 'close',
    'lastPrice', 'variation', 'trend', 'setlementPrice',
    'adjacentPrice', 'openInterest', 'turnover', 'trades',
    'doubleTotalAmount', 'longOperations', 'emisionTime', 'emisionDate',
    'strikePrice', 'executionMonthOrder'
  ])
})

test('get stock price', async function (t) {
  const broker = new BullMarket({
    email: process.env.EMAIL,
    password: process.env.PASSWORD,
    fingerprint: process.env.FINGERPRINT
  })

  await broker.login()

  const stocks = await broker.getStockPrice([{ symbol: 'AAPL', term: '48' }, { symbol: 'SHOP', term: '48hs' }])

  t.alike(Object.keys(stocks[0]), [
    'metadataTrace', 'fixNumber', 'idFixNumbers', 'indexes',
    'date', 'stockState', 'stockOffer', 'change',
    'priceChanged', 'expirationDate', 'ticker', 'term',
    'emisionTime', 'emisionDate', 'strikePrice', 'executionMonthOrder'
  ])

  t.alike(Object.keys(stocks[0].stockState), [
    'open', 'min', 'max', 'price',
    'totalNominalValue', 'totalAmount', 'operations', 'close',
    'lastPrice', 'variation', 'trend', 'setlementPrice',
    'adjacentPrice', 'openInterest', 'turnover', 'trades',
    'doubleTotalAmount', 'longOperations', 'emisionTime', 'emisionDate',
    'strikePrice', 'executionMonthOrder'
  ])

  t.is(stocks[0].ticker, 'AAPL')
  t.is(stocks[1].ticker, 'SHOP')
  t.is(stocks[0].term, '3')
  t.is(stocks[1].term, '3')

  const pair = await broker.getStockPrice([{ symbol: 'SHOP', term: 'ci' }, { symbol: 'SHOP', term: '48hs' }])

  t.is(pair[0].ticker, 'SHOP')
  t.is(pair[1].ticker, 'SHOP')
  t.is(pair[0].term, '1')
  t.is(pair[1].term, '3')
})

test('get account balance', async function (t) {
  const broker = new BullMarket({
    email: process.env.EMAIL,
    password: process.env.PASSWORD,
    fingerprint: process.env.FINGERPRINT
  })

  await broker.login()

  const stockAccounts = await broker.getStockAccounts()
  const balance = await broker.getAccountBalance(stockAccounts[0].number)

  t.alike(Object.keys(balance), ['stockAccountNumber', 'currency', 'galloWarranty', 'url', 'sortColumn', 'isAscending', 'page', 'totalRowCount', 'pagingInfo', 'pageSize', 'records', 'requestExcel'])
  t.alike(Object.keys(balance.pagingInfo), ['totalRows', 'totalPages', 'hasNextPages', 'hasPrevPages', 'nextPageSetIndex', 'prevPageSetIndex', 'pages'])
  t.alike(Object.keys(balance.records[0]), ['orderColumn', 'amount', 'previousAmount', 'receiptCode', 'createdDate', 'receiptNumber', 'receiptName', 'quantity', 'price', 'stockTicker', 'reference', 'settlementDate', 'transactionDate', 'transactionNumber', 'codeUrl'])

  const record = balance.records[0]

  t.is(typeof record.orderColumn, 'number')
  t.is(typeof record.amount, 'number')
  t.is(typeof record.previousAmount, 'number')
  t.is(typeof record.receiptCode, 'string')
  t.is(typeof record.createdDate, 'string')
  t.is(typeof record.receiptNumber, 'number')
  t.is(typeof record.receiptName, 'string')
  t.is(typeof record.quantity, 'number')
  t.is(typeof record.price, 'number')
  t.is(typeof record.stockTicker, 'string')
  t.is(typeof record.reference, 'string')
  t.is(typeof record.settlementDate, 'string')
  t.is(typeof record.transactionDate, 'string')
  t.is(typeof record.transactionNumber, 'number')
  t.is(typeof record.codeUrl, 'number')
})

test('get stock description', async function (t) {
  const broker = new BullMarket({
    email: process.env.EMAIL,
    password: process.env.PASSWORD,
    fingerprint: process.env.FINGERPRINT
  })

  await broker.login()

  const description = await broker.getStockDescription('ALUA')
  t.is(typeof description, 'string')

  t.ok(await broker.getStockDescription('AAPL'))
})

test('trading time', async function (t) {
  const broker = new BullMarket({
    email: process.env.EMAIL,
    password: process.env.PASSWORD,
    fingerprint: process.env.FINGERPRINT
  })

  await broker.login()

  const time = await broker.tradingTime()
  t.is(typeof time, 'number')
})

test('trading history', async function (t) {
  const broker = new BullMarket({
    email: process.env.EMAIL,
    password: process.env.PASSWORD,
    fingerprint: process.env.FINGERPRINT
  })

  await broker.login()

  const time = await broker.tradingTime()

  const history = await broker.tradingHistory('AAPL', {
    from: time - (86400 * 3),
    to: time
  })

  const lastClose = history.c[history.c.length - 1]
  t.is(typeof lastClose, 'number')
})

test('hub - join stock price change', async function (t) {
  const broker = new BullMarket({
    email: process.env.EMAIL,
    password: process.env.PASSWORD,
    fingerprint: process.env.FINGERPRINT
  })

  await broker.hub.connect()

  await broker.hub.joinStockPriceChange('DOLARES CABLE', '48hs')
  await broker.hub.joinStockPriceChange('PYPL', '48hs')

  // TODO: Test receiving changes (market is closed atm)

  await broker.hub.disconnect()
})

test('hub - connect and disconnect multiple times', async function (t) {
  const broker = new BullMarket({
    email: process.env.EMAIL,
    password: process.env.PASSWORD,
    fingerprint: process.env.FINGERPRINT
  })

  //
  await broker.hub.connect()
  await broker.hub.connect()
  await broker.hub.disconnect()

  //
  await broker.hub.connect()

  await broker.hub.joinStockPriceChange('DOLARES CABLE', '48hs')
  await broker.hub.joinStockPriceChange('PYPL', '48hs')

  await broker.hub.disconnect()

  try {
    await broker.hub.joinStockPriceChange('PYPL', '48hs')
    t.fail('Should have failed')
  } catch (err) {
    t.pass(err.message)
  }

  //
  await broker.hub.connect()

  broker.hub.disconnect()
  await broker.hub.connect()

  await broker.hub.joinStockPriceChange('DOLARES CABLE', '48hs')
  await broker.hub.joinStockPriceChange('PYPL', '48hs')

  await broker.hub.disconnect()

  //
  broker.hub.connect()
  await broker.hub.disconnect()

  try {
    await broker.hub.joinStockPriceChange('PYPL', '48hs')
    t.fail('Should have failed')
  } catch (err) {
    t.pass(err.message)
  }

  //
  await broker.hub.connect()

  await Promise.all([
    broker.hub.disconnect(),
    broker.hub.connect()
  ])

  await broker.hub.joinStockPriceChange('DOLARES CABLE', '48hs')
  await broker.hub.joinStockPriceChange('PYPL', '48hs')

  await broker.hub.disconnect()

  try {
    await broker.hub.joinStockPriceChange('PYPL', '48hs')
    t.fail('Should have failed')
  } catch (err) {
    t.pass(err.message)
  }

  //
  try {
    await broker.hub.connect(true)
    t.fail('Should have failed')
  } catch (err) {
    t.pass(err.message)
  }

  await broker.hub.disconnect()
  await broker.hub.connect()

  await broker.hub.joinStockPriceChange('DOLARES CABLE', '48hs')
  await broker.hub.joinStockPriceChange('PYPL', '48hs')

  await broker.hub.disconnect()

  try {
    await broker.hub.joinStockPriceChange('PYPL', '48hs')
    t.fail('Should have failed')
  } catch (err) {
    t.pass(err.message)
  }

  //
  try {
    await broker.hub.connect(true)
    t.fail('Should have failed')
  } catch (err) {
    t.pass(err.message)
  }

  broker.hub.disconnect()
  await broker.hub.connect()

  await broker.hub.joinStockPriceChange('DOLARES CABLE', '48hs')
  await broker.hub.joinStockPriceChange('PYPL', '48hs')

  await broker.hub.disconnect()

  try {
    await broker.hub.joinStockPriceChange('PYPL', '48hs')
    t.fail('Should have failed')
  } catch (err) {
    t.pass(err.message)
  }

  //
  await broker.hub.connect()

  await broker.hub.joinStockPriceChange('DOLARES CABLE', '48hs')
  await broker.hub.joinStockPriceChange('PYPL', '48hs')

  try {
    await broker.hub.disconnect(new Error('Failure'))
    t.fail('Should have failed')
  } catch (err) {
    t.pass(err.message)
  }

  await broker.hub.connect()

  await broker.hub.joinStockPriceChange('DOLARES CABLE', '48hs')
  await broker.hub.joinStockPriceChange('PYPL', '48hs')

  await broker.hub.disconnect()

  try {
    await broker.hub.joinStockPriceChange('PYPL', '48hs')
    t.fail('Should have failed')
  } catch (err) {
    t.pass(err.message)
  }
})
