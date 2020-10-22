//setInterval(() => {

(async () => {
  let name = 'buy-ci/sell-48hs';

  let ci1 = await getStock('merval', 'ci');
  let ci2 = await getStock('panel general', 'ci');
  let ci = ci1.concat(ci2);

  let hs1 = await getStock('merval', '48hs');
  let hs2 = await getStock('panel general', '48hs');
  let hs = hs1.concat(hs2);

  ci = ci.map(normalizeStock).filter(ci => ci !== null);
  hs = hs.map(normalizeStock).filter(hs => hs !== null);

  for (let current of ci) {
    let future = hs.find(stock => stock.ticker === current.ticker);
    if (!future) {
      console.log('future not found from current', current);
      continue;
    }

    if (isObjectEqual([current, future], cache(name + '/' + current.ticker))) {
      //console.log('cache hit', name + '/' + current.ticker);
      continue;
    }
    cache(name + '/' + current.ticker, [current, future]);

    if (current.buy.price < future.sell.price) {
      let isStrong = current.buy.price * 1.0075 < future.sell.price;
      console.log(isStrong ? 'strong' : '', name, showPercent(future.sell.price / current.buy.price) + '%', current, future);

      addTable(current.ticker, current.buy.price, future.sell.price, Math.min(current.buy.quantity, future.sell.quantity));

      if (!isStrong) {
        continue;
      }

      /*console.log('buying', current.ticker, 'at', current.buy.price);
      let buyOrder = await fixOrder({ side: 'buy', ticker: current.ticker, quantity: 1, price: current.buy.price, term: 'ci' });
      console.log('bought', buyOrder);

      await sleep(2000);

      console.log('selling', future.ticker, 'at', future.sell.price);
      let sellOrder = await fixOrder({ side: 'sell', ticker: future.ticker, quantity: 1, price: future.sell.price, term: '48hs' });
      console.log('sold', sellOrder);

      break;*/
    }
  }
})();

//}, 5000);

(async () => {
  let optionsCi = await getStock('opciones', 'ci');

  let stocksCi1 = await getStock('merval', 'ci');
  let stocksCi2 = await getStock('panel general', 'ci');
  let stocksCi = stocksCi1.concat(stocksCi2);

  let stocksHs1 = await getStock('merval', '48hs');
  let stocksHs2 = await getStock('panel general', '48hs');
  let stocksHs = stocksHs1.concat(stocksHs2);

  await main('ci/ci', optionsCi, stocksCi);
  await main('ci/48hs', optionsCi, stocksHs);

  async function main (name, options, stocks) {
    name = 'buy-option/sell-market/' + name;

    options = options.map(normalizeOption).filter(option => option !== null);
    stocks = stocks.map(normalizeStock).filter(stock => stock !== null);

    for (let option of options) {
      let stock = stocks.find(stock => stock.ticker.indexOf(option.ticker) === 0);
      if (!stock) {
        //console.log('stock not found from option', option);
        continue;
      }

      if (isObjectEqual([option, stock], cache(name + '/' + option.id))) {
        //console.log('cache hit', name + '/' + option.id);
        continue;
      }
      cache(name + '/' + option.id, [option, stock]);

      if (option.action === 'C') {
        if (option.price < stock.sell.price) {
          let isStrong = option.price * 1.0075 < stock.sell.price;
          console.log(isStrong ? 'strong' : '', name, option, stock);
        }
      } else {
        if (option.price > stock.buy.price) {
          let isStrong = option.price > stock.buy.price * 1.0075;
          console.log(isStrong ? 'strong' : '', name, option, stock);
        }
      }
    }
  }
})();

(async () => {
  let optionsCi = await getStock('opciones', 'ci');
  let options48hs = await getStock('opciones', '48hs');

  await main('ci/ci', optionsCi, optionsCi);
  await main('ci/48hs', optionsCi, options48hs);
  await main('48hs/ci', options48hs, optionsCi);
  await main('48hs/48hs', options48hs, options48hs);

  async function main (name, optionsBuy, optionsSell) {
    name = 'buy-option/sell-option/' + name;

    optionsBuy = optionsBuy.map(normalizeOption).filter(option => option !== null);

    for (let option of optionsBuy) {
      if (option.action !== 'C') {
        continue;
      }

      let call = option;
      let put = optionsSell.find(opt => opt.ticker === option.ticker && opt.action === 'V');
      if (!put) {
        continue;
      }

      if (isObjectEqual([call, put], cache(name + '/' + option.id))) {
        //console.log('cache hit', name + '/' + option.id);
        continue;
      }
      cache(name + '/' + option.id, [call, put]);

      if (call.price <= put.price) {
        let isStrong = call.price * 1.0075 < put.price;
        console.log(isStrong ? 'strong' : '', name, call, put);
      }
    }
  }
})();

function normalizeStock (stock) {
  if (!stock.stockOffer.ask[0] || !stock.stockOffer.bid[0]) {
    return null;
  }

  let ask = stock.stockOffer.ask[0];
  let bid = stock.stockOffer.bid[0];

  return {
    ticker: stock.ticker,
    buy: { // vos comprás a este precio
      price: ask.price,
      quantity: ask.quantity
    },
    sell: { // vos vendés a este precio
      price: bid.price,
      quantity: bid.quantity
    },
    type: 'stock'
  };
}

function normalizeOption (option) {
  if (!option.stockOffer.ask[0]) {
    return null;
  }

  let ticker = option.ticker.match(/(.*?)(C|V)([\d\.]+)(.*)/i);
  let ask = option.stockOffer.ask[0];

  if (!ticker) {
    return null;
  }

  let ret = {
    id: option.ticker,
    ticker: fixTicker(ticker[1]),
    action: ticker[2],
    strike: parseFloat(ticker[3]),
    prima: ask.price,
    price: 0.0,
    quantity: ask.quantity,
    expiry: ticker[4],
    type: 'option'
  };

  ret.price = ret.action === 'C' ? ret.strike + ret.prima : ret.strike - ret.prime;

  return ret;

  function fixTicker (ticker) {
    if (ticker === 'GFG') ticker = 'GGAL';
    return ticker;
  }
}

// getStock('panel general', 'ci');
// getStock('opciones', '48hs');
function getStock (index, term) {
  index = index.replace(/\s/g, '+').toLowerCase();
  term = term === 'ci' ? 1 : 3;

  return fetch('https://www.bullmarketbrokers.com/Information/StockPrice/GetStockPrices?_ts=' + Date.now() + '&term=' + term + '&index=' + index + '&sortColumn=ticker&isAscending=true', {
    "headers": {
      "accept": "*/*",
      "accept-language": "en,es;q=0.9,ru;q=0.8",
      "cache-control": "no-cache",
      "pragma": "no-cache",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "x-requested-with": "XMLHttpRequest"
    },
    "referrer": "https://www.bullmarketbrokers.com/Cotizaciones/Acciones",
    "referrerPolicy": "no-referrer-when-downgrade",
    "body": null,
    "method": "GET",
    "mode": "cors",
    "credentials": "include"
  }).then(response => {
    return response.json();
  }).then(json => {
    return json.result;
  });
}

// fixOrder({ side: 'buy', ticker: 'CEPU', quantity: 5, price: 33.10, term: 'ci' }); // buy  cepu x5 $33.10 at ci
// fixOrder({ side: 'sell', ticker: 'CEPU', quantity: 5, price: 33.15, term: '48hs' }); // sell cepu x5 $33.15 at 48hs
function fixOrder ({ side, ticker, quantity, price, term }) {
  side = side === 'buy' ? 1 : 2;
  term = term === 'ci' ? 1 : 3;
  let amount = quantity * price;

  return fetch("https://www.bullmarketbrokers.com/Operations/Orders/FixOrder", {
    "headers": {
      "accept": "application/json, text/javascript, */*; q=0.01",
      "accept-language": "en,es;q=0.9,ru;q=0.8",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "x-requested-with": "XMLHttpRequest"
    },
    "referrer": "https://www.bullmarketbrokers.com/Clients/MildOrder",
    "referrerPolicy": "no-referrer-when-downgrade",
    "body": 'market=BYMA&account=85035&amount=' + encodeNumber(amount) + '&orderType=2&securityType=CS&symbol=' + ticker + '&settlType=' + term + '&timeInForce=0&expireDate=&side=' + side + '&currency=ARS&quantity=' + quantity + '&settleDate=&source=&price=' + encodeNumber(price) + '&stopPrice=&send=true&forceOrder=false&orderCapacity=B',
    "method": "POST",
    "mode": "cors",
    "credentials": "include"
  }).then(response => {
    return response.json();
  });

  function encodeNumber (value) {
    return encodeURIComponent(value.toString().replace('.', ','));
  }
}

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function showPercent (value) {
  return parseFloat(((value - 1) * 100).toString().substr(0, 5));
}

function addTable (ticker, buyPrice, sellPrice, quantity) {
  return fetch('https://api.airtable.com/v0/appJN6hlyipVoyDUH/Operations', {
    method: 'POST',
    headers: {
      authorization: 'Bearer keyWkacw7v5N9JbUz',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      "records": [
        {
          "fields": {
            "Ticker": ticker,
            "Compra": buyPrice,
            "Venta": sellPrice,
            "Cant": quantity
          }
        }
      ]
    })
  });
}

// cache('merval-ci', '{...}');
// cache('merval-ci');
function cache (key, value) {
  key = 'market_cache_' + key;
  // get
  if (arguments.length === 1) {
    return window[key];
  }
  // set
  window[key] = value;
}

// from stackoverflow or https://gomakethings.com/check-if-two-arrays-or-objects-are-equal-with-javascript/
function isObjectEqual (value, other) {
  var type = Object.prototype.toString.call(value);
  if (type !== Object.prototype.toString.call(other)) return false;
  if (['[object Array]', '[object Object]'].indexOf(type) < 0) return false;

  var valueLen = type === '[object Array]' ? value.length : Object.keys(value).length;
  var otherLen = type === '[object Array]' ? other.length : Object.keys(other).length;
  if (valueLen !== otherLen) return false;

  var compare = function (item1, item2) {
    var itemType = Object.prototype.toString.call(item1);

    if (['[object Array]', '[object Object]'].indexOf(itemType) >= 0) {
      if (!isObjectEqual(item1, item2)) return false;
    } else {
      if (itemType !== Object.prototype.toString.call(item2)) return false;
      if (itemType === '[object Function]') {
        if (item1.toString() !== item2.toString()) return false;
      } else {
        if (item1 !== item2) return false;
      }
    }
  };

  if (type === '[object Array]') {
    for (var i = 0; i < valueLen; i++) {
      if (compare(value[i], other[i]) === false) return false;
    }
  } else {
    for (var key in value) {
      if (value.hasOwnProperty(key)) {
        if (compare(value[key], other[key]) === false) return false;
      }
    }
  }

  return true;
}
