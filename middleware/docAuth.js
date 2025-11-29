const basicAuth = require('express-basic-auth');

/**
 * Basic Auth middleware for protecting Swagger documentation
 * Credentials loaded from environment variables
 */
const docAuth = basicAuth({
  users: { 
    [process.env.DOC_USERNAME || 'admin']: process.env.DOC_PASSWORD || 'ADM1NC0Y'
  },
  challenge: true,
  realm: 'MyDosen API Documentation',
  unauthorizedResponse: (req) => {
    return 'Unauthorized - Please provide valid credentials to access API documentation';
  }
});

module.exports = docAuth;
