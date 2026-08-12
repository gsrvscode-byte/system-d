const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');

const signToken = (payload) => jwt.sign(payload, jwtConfig.secret, { expiresIn: jwtConfig.expiresIn });

const verifyToken = (token) => jwt.verify(token, jwtConfig.secret);

module.exports = { signToken, verifyToken };
