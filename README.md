# bullmarket

Bull Market Brokers API for Node.js

```
npm i bullmarket
```

https://www.bullmarketbrokers.com

## Usage

```js
const BullMarket = require('bullmarket')

const broker = new BullMarket({
  email: 'email@gmail.com',
  password: 'p4ssw0rd',
  fingerprint: '<inspect element at /Security/SignIn to find it>'
})

await broker.login()

const stockAccounts = await broker.getStockAccounts()
await broker.setStockAccount(stockAccounts[0].number)

const screen = await broker.getScreen(stockAccounts[0].number)
const orders = await broker.getOrders(stockAccounts[0].number)
const balance = await broker.getAccountBalance(stockAccounts[0].number)
const dollars = await broker.getDollarsPrice()

const stocks1 = await broker.getStockPrices('merval', 'ci')
const stocks2 = await broker.getStockPrices('panel general', 'ci')
const stocks3 = await broker.getStockPrices('opciones', 'ci')
const stocks4 = await broker.getStockPrices('bonos', 'ci')
const stocks5 = await broker.getStockPrices('cedears', 'ci')
const stocks6 = await broker.getStockPrices('cauciones', 'ci')

const stocks7 = await broker.getStockPrices('merval', '48hs')
const stocks8 = await broker.getStockPrices('panel general', '48hs')

await broker.logout()
```

## License

MIT
