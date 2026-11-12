function fn() {
  // Reuse the same app launcher as the JUnit suites: an existing instance via
  // -Dshoplite.baseUrl, otherwise ShopLite is started on a free port with a fresh DB.
  var ShopLiteServer = Java.type('com.shoplite.support.ShopLiteServer');
  var config = {
    baseUrl: ShopLiteServer.baseUrl(),
    users: {
      alice: { email: 'alice@shoplite.test', password: 'Passw0rd!' },
      bob: { email: 'bob@shoplite.test', password: 'Passw0rd!' },
      admin: { email: 'admin@shoplite.test', password: 'Adm1nPass!' }
    }
  };
  karate.configure('connectTimeout', 5000);
  karate.configure('readTimeout', 5000);
  karate.configure('logPrettyResponse', true);
  return config;
}
