const jwt = require("jsonwebtoken");

module.exports = function (req, res, next) {
    console.log(req.cookie.token);

    
    next();
  }