const test = require('brittle')
const BullMarket = require('./index.js')

if (!process.env.EMAIL || !process.env.PASSWORD || !process.env.FINGERPRINT) {
  console.error('You have to pass all the ENV variables like this:')
  console.error('EMAIL="email@gmail.com" PASSWORD="1234" FINGERPRINT="abcd1234b4c0d1dc9d60e824b3cb71c0" npm run test')
  process.exit(1)
}

test('login', async function (t) {
  t.plan(2)

  const broker = new BullMarket({
    email: process.env.EMAIL,
    password: process.env.PASSWORD,
    fingerprint: process.env.FINGERPRINT
  })

  t.is(broker.session, null)

  await broker.login()

  t.alike(Object.keys(broker.session), ['BullMarketGroup', '__RequestVerificationToken', 'ASP.NET_SessionId', 'BMB'])
})

test('logout', async function (t) {
  t.plan(2)

  const broker = new BullMarket({
    email: process.env.EMAIL,
    password: process.env.PASSWORD,
    fingerprint: process.env.FINGERPRINT
  })

  await broker.login()
  // const saved = broker.session

  t.ok(await broker.getStockAccounts())

  await broker.logout()
  // broker.session = saved // TODO: Their server doesn't actually revokes the old session, it just clears the cookies

  try {
    console.log(await broker.getStockAccounts())
    t.fail('should have failed')
  } catch {
    t.pass()
  }
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

  const asset = screen.screen.assets[0]

  t.alike(Object.keys(asset), ['symbol', 'securityExchange', 'name', 'currency', 'price', 'multiplier', 'closePrice', 'variation', 'detailedQuantity', 'compromisedQuantities', 'detailWarranties', 'settleQuantity', 'market', 'marginRatio', 'warningAmount', 'amount', 'strategyAmount', 'closeAmount', 'earnings', 'warrantyAmount', 'settleAmount', 'buyAveragePrice', 'aforoRofex', 'inRofexWarranty'])

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

  t.alike(Object.keys(dollars), ['dollarMep', 'dollarCable', 'dollarMepRestricciones', 'dollarCableRestricciones', 'dollarSenebi', 'dollarSenebiCable'])

  for (const name in dollars) {
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
