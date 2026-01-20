// ============================================
// FILE: services/GoBizService.js
// ============================================
const axios = require(‘axios’);
const crypto = require(‘crypto’);

class GoBizService {
constructor() {
this.baseURL = ‘https://api.gobiz.co.id’;
this.sessions = new Map(); // Store sessions per user
}

createSession(userId) {
const session = {
accessToken: null,
refreshToken: null,
uniqueId: crypto.randomUUID(),
lastRequestTime: 0,
minRequestInterval: 2000,
merchantId: null
};
this.sessions.set(userId, session);
return session;
}

getSession(userId) {
return this.sessions.get(userId);
}

deleteSession(userId) {
this.sessions.delete(userId);
}

async waitForRateLimit(session) {
const now = Date.now();
const timeSinceLastRequest = now - session.lastRequestTime;

if (timeSinceLastRequest < session.minRequestInterval) {
  const waitTime = session.minRequestInterval - timeSinceLastRequest;
  await new Promise(resolve => setTimeout(resolve, waitTime));
}

session.lastRequestTime = Date.now();

}

getCommonHeaders(uniqueId) {
return {
‘Content-Type’: ‘application/json’,
‘Accept’: ‘application/json, text/plain, */*’,
‘Accept-Language’: ‘id’,
‘Accept-Encoding’: ‘gzip, deflate, br, zstd’,
‘Origin’: ‘https://portal.gofoodmerchant.co.id’,
‘Referer’: ‘https://portal.gofoodmerchant.co.id/’,
‘Authentication-Type’: ‘go-id’,
‘Gojek-Country-Code’: ‘ID’,
‘Gojek-Timezone’: ‘Asia/Jakarta’,
‘X-Appid’: ‘go-biz-web-dashboard’,
‘X-Appversion’: ‘platform-v3.97.0-b986b897’,
‘X-Deviceos’: ‘Web’,
‘X-Phonemake’: ‘Windows 10 64-bit’,
‘X-Phonemodel’: ‘Chrome 143.0.0.0 on Windows 10 64-bit’,
‘X-Platform’: ‘Web’,
‘X-Uniqueid’: uniqueId,
‘X-User-Locale’: ‘en-US’,
‘X-User-Type’: ‘merchant’,
‘User-Agent’: ‘Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36’,
‘sec-ch-ua’: ‘“Google Chrome”;v=“143”, “Chromium”;v=“143”’,
‘sec-ch-ua-mobile’: ‘?0’,
‘sec-ch-ua-platform’: ‘“Windows”’,
‘sec-fetch-dest’: ‘empty’,
‘sec-fetch-mode’: ‘cors’,
‘sec-fetch-site’: ‘cross-site’
};
}

async requestLogin(email, session) {
await this.waitForRateLimit(session);

const response = await axios({
  method: 'post',
  url: `${this.baseURL}/goid/login/request`,
  headers: this.getCommonHeaders(session.uniqueId),
  data: {
    email: email,
    login_type: 'password',
    client_id: 'go-biz-web-new'
  }
});

return response.data;

}

async loginWithPassword(email, password, session) {
await this.waitForRateLimit(session);

const response = await axios({
  method: 'post',
  url: `${this.baseURL}/goid/token`,
  headers: this.getCommonHeaders(session.uniqueId),
  data: {
    client_id: 'go-biz-web-new',
    grant_type: 'password',
    data: {
      email: email,
      password: password,
      user_type: 'merchant'
    }
  }
});

session.accessToken = response.data.access_token;
session.refreshToken = response.data.refresh_token;

return response.data;

}

async login(userId, email, password) {
const session = this.createSession(userId);
await this.requestLogin(email, session);
await new Promise(resolve => setTimeout(resolve, 3000));
const tokenData = await this.loginWithPassword(email, password, session);

return {
  accessToken: tokenData.access_token,
  refreshToken: tokenData.refresh_token,
  expiresIn: tokenData.expires_in
};

}

async refreshAccessToken(userId) {
const session = this.getSession(userId);
if (!session || !session.refreshToken) {
throw new Error(‘Session tidak ditemukan atau refresh token tidak tersedia’);
}
await this.waitForRateLimit(session);

const response = await axios({
  method: 'post',
  url: `${this.baseURL}/goid/token`,
  headers: this.getCommonHeaders(session.uniqueId),
  data: {
    grant_type: 'refresh_token',
    refresh_token: session.refreshToken,
    client_id: 'go-biz-web-new'
  }
});

session.accessToken = response.data.access_token;
session.refreshToken = response.data.refresh_token;

return {
  accessToken: response.data.access_token,
  refreshToken: response.data.refresh_token,
  expiresIn: response.data.expires_in
};

}

async searchJournals(userId, merchantId, fromDate, toDate, options = {}) {
const session = this.getSession(userId);
if (!session || !session.accessToken) {
throw new Error(‘Belum terautentikasi’);
}
await this.waitForRateLimit(session);

const payload = {
  from: options.from || 0,
  size: options.size || 20,
  sort: {
    time: {
      order: options.sortOrder || 'desc'
    }
  },
  included_categories: {
    incoming: ['transaction_share', 'action']
  },
  query: [
    {
      clauses: [
        {
          op: 'not',
          clauses: [
            {
              clauses: [
                {
                  field: 'metadata.source',
                  op: 'in',
                  value: ['GOSAVE_ONLINE', 'GoSave', 'GODEALS_ONLINE']
                },
                {
                  field: 'metadata.gopay.source',
                  op: 'in',
                  value: ['GOSAVE_ONLINE', 'GoSave', 'GODEALS_ONLINE']
                }
              ],
              op: 'or'
            }
          ]
        },
        {
          field: 'metadata.transaction.status',
          op: 'in',
          value: ['settlement', 'capture', 'refund', 'partial_refund']
        },
        {
          op: 'or',
          clauses: [
            {
              op: 'or',
              clauses: [
                {
                  field: 'metadata.transaction.payment_type',
                  op: 'in',
                  value: ['qris', 'gopay', 'offline_credit_card', 'offline_debit_card', 'credit_card']
                }
              ]
            }
          ]
        },
        {
          field: 'metadata.transaction.transaction_time',
          op: 'gte',
          value: fromDate
        },
        {
          field: 'metadata.transaction.transaction_time',
          op: 'lte',
          value: toDate
        },
        {
          field: 'metadata.transaction.merchant_id',
          op: 'equal',
          value: merchantId
        }
      ],
      op: 'and'
    }
  ]
};

const response = await axios({
  method: 'post',
  url: `${this.baseURL}/journals/search`,
  headers: {
    ...this.getCommonHeaders(session.uniqueId),
    'Authorization': `Bearer ${session.accessToken}`
  },
  data: payload
});

return response.data;

}

async makeRequest(userId, endpoint, method = ‘POST’, data = null, retried = false) {
const session = this.getSession(userId);
if (!session || !session.accessToken) {
throw new Error(‘Belum terautentikasi’);
}
await this.waitForRateLimit(session);

try {
  const response = await axios({
    method: method,
    url: `${this.baseURL}${endpoint}`,
    headers: {
      ...this.getCommonHeaders(session.uniqueId),
      'Authorization': `Bearer ${session.accessToken}`
    },
    data: data
  });

  return response.data;
} catch (error) {
  if (error.response?.status === 401 && !retried) {
    await this.refreshAccessToken(userId);
    return this.makeRequest(userId, endpoint, method, data, true);
  }
  throw error;
}

}
}

module.exports = new GoBizService();
