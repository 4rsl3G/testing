const axios = require('axios');
const crypto = require('crypto');

class GoBizAuth {
  constructor() {
    this.baseURL = 'apigopay';
    this.accessToken = null;
    this.refreshToken = null;
    this.uniqueId = crypto.randomUUID();
  }

  getCommonHeaders() {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'id',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Origin': 'https://portal.gofoodmerchant.co.id',
      'Referer': 'https://portal.gofoodmerchant.co.id/',
      'Authentication-Type': 'go-id',
      'Authorization': 'Bearer',
      'Gojek-Country-Code': 'ID',
      'Gojek-Timezone': 'Atlantic/Reykjavik',
      'X-Appid': 'go-biz-web-dashboard',
      'X-Appversion': 'platform-v3.97.0-b986b897',
      'X-Deviceos': 'Web',
      'X-Phonemake': 'Windows 10 64-bit',
      'X-Phonemodel': 'Chrome 143.0.0.0 on Windows 10 64-bit',
      'X-Platform': 'Web',
      'X-Uniqueid': this.uniqueId,
      'X-User-Locale': 'en-US',
      'X-User-Type': 'merchant',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
      'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'cross-site'
    };
  }

  // Step 1: Request Login (FIXED - menggunakan login_type bukan user_type)
  async requestLogin(email) {
    try {
      console.log('\n📧 Step 1: Requesting login for:', email);
      
      const response = await axios({
        method: 'post',
        url: `${this.baseURL}/goid/login/request`,
        headers: this.getCommonHeaders(),
        data: {
          email: email,
          login_type: 'password',  // ✅ Ini yang benar!
          client_id: 'go-biz-web-new'
        }
      });

      console.log('✅ Login request successful!');
      console.log('   Status:', response.status);
      console.log('   Request ID:', response.headers['request-id']);
      console.log('   Transaction ID:', response.headers['transaction-id']);
      console.log('   Verification Method:', response.headers['x-verification-method']);
      
      if (response.data.data) {
        console.log('   Next State:', response.data.data.next_state?.state);
      }
      
      return response.data;
    } catch (error) {
      console.error('❌ Step 1 failed!');
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Error:', JSON.stringify(error.response.data, null, 2));
      } else {
        console.error('   Error:', error.message);
      }
      throw error;
    }
  }

  // Step 2: Login with Password
  async loginWithPassword(email, password) {
    try {
      console.log('\n🔐 Step 2: Logging in with password...');
      
      const response = await axios({
        method: 'post',
        url: `${this.baseURL}/goid/token`,
        headers: this.getCommonHeaders(),
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

      this.accessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;

      console.log('✅ Login successful!');
      console.log('   Access Token:', this.accessToken ? this.accessToken.substring(0, 50) + '...' : 'N/A');
      console.log('   Refresh Token:', this.refreshToken ? this.refreshToken.substring(0, 50) + '...' : 'N/A');
      console.log('   DBL Enabled:', response.data.dbl_enabled);
      
      return response.data;
    } catch (error) {
      console.error('❌ Step 2 failed!');
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Error:', JSON.stringify(error.response.data, null, 2));
      } else {
        console.error('   Error:', error.message);
      }
      throw error;
    }
  }

  // Complete Login Flow
  async login(email, password) {
    try {
      console.log('\n🚀 Starting login process');
      console.log('═'.repeat(60));
      
      // Step 1: Request login
      await this.requestLogin(email);
      
      // Wait 500ms between requests
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 2: Login with password
      const tokenData = await this.loginWithPassword(email, password);
      
      console.log('\n' + '═'.repeat(60));
      console.log('🎉 Login completed successfully!');
      console.log('═'.repeat(60));
      
      return tokenData;
    } catch (error) {
      console.error('\n' + '═'.repeat(60));
      console.error('💥 Login process failed!');
      console.error('═'.repeat(60));
      throw error;
    }
  }

  // Make authenticated request
  async makeAuthenticatedRequest(endpoint, method = 'POST', data = null) {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Please login first.');
    }

    try {
      const response = await axios({
        method: method,
        url: `${this.baseURL}${endpoint}`,
        headers: {
          ...this.getCommonHeaders(),
          'Authorization': `Bearer ${this.accessToken}`
        },
        data: data
      });

      console.log('✅ Request successful!');
      return response.data;
    } catch (error) {
      console.error('❌ Request failed:', error.response?.data || error.message);
      throw error;
    }
  }
}

// ============================================
// USAGE
// ============================================

const auth = new GoBizAuth();

auth.login('email', 'passwd')
  .then(async (tokenData) => {
    console.log('\n✨ Successfully authenticated!');
    console.log('\nAccess Token:', tokenData.access_token);
    console.log('Refresh Token:', tokenData.refresh_token);
    
    // Example: Search merchants
    console.log('\n📍 Testing authenticated request...');
    const merchants = await auth.makeAuthenticatedRequest('/v1/merchants/search', 'POST', {
      // Add your search parameters here
    });
    console.log('Merchants:', merchants);
  })
  .catch(error => {
    console.error('Authentication failed');
  });
