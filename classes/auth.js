const axios = require('axios')
const NodeCache = require('node-cache')
const crypto = require('crypto')
require('dotenv').config();

console.log('Auth class')
let Auth = class {
    clientId = process.env.CLIENT_ID
    clientSecret = process.env.CLIENT_SECRET
    redirectUrl = process.env.REDIRECT_URL
    refreshToken = process.env.REFRESH_TOKEN
    serverUrl = process.env.SERVER_URL

    constructor() {
        this.cache = new NodeCache();
    }

    async login(code) {
        let data = {}
        data.grant_type = 'authorization_code'
        data.code = code
        data.client_id = this.clientId
        data.client_secret = this.clientSecret
        data.redirect_uri = this.redirectUrl

        let queryString = ''
        for (const property in data) {
            queryString += property + '=' + data[property] + '&'
        }
        let urlLogin = 'https://api.hubapi.com/oauth/v1/token'
        let promise = axios.post(urlLogin, queryString, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' }
        })
        return promise
            .then(response => {
                //save refresh token and access token
                this.setAccessToken(response.data.access_token)
                console.log(response.data)
                return response.data

            })
            .catch((error) => {
                console.log(error)
                return false
            })
    }

    async getAccessToken() {
        // check cache
        let accessToken = this.cache.get('token')
        if (accessToken == undefined) {
            //set cache if not there
            await this.updateAccessToken()
        }

        // get from cache
        return this.cache.get('token')
        // return process.env.HS_PROD_KEY
    }
    setAccessToken(token) {
        return this.cache.set('token', token, 1700)
    }

    async updateAccessToken() {
        //if access token does not exist/exprie
        let data = {}
        data.grant_type = 'refresh_token'
        data.client_id = this.clientId
        data.client_secret = this.clientSecret
        data.redirect_uri = this.redirectUrl
        data.refresh_token = this.refreshToken

        let queryString = ''
        for (const property in data) {
            queryString += property + '=' + data[property] + '&'
        }
        let urlLogin = 'https://api.hubapi.com/oauth/v1/token'
        let promise = axios.post(urlLogin, queryString, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' }
        })
        console.log('Token is updated')
        return await promise
            .then(response => {
                //save access token
                return this.setAccessToken(response.data.access_token)

            })
            .catch((error) => {
                return false

            })

    }

    async getConfig() {

        let token = await this.getAccessToken()
        let config = {
            headers: { Authorization: `Bearer ${token}` }
        }
        return config
    }

    // async authoriseRequest(request) {

    //     // console.log(request.headers)
    //     var httpURI = this.serverUrl + request.originalUrl;
    //     let bodyString = ''
    //     if(Object.keys(request.body).length > 0){
    //         bodyString = JSON.stringify(request.body)
    //     } 
    //     let sourceString = this.clientSecret + request.method + httpURI + bodyString

    //     let hash = crypto.createHash('sha256').update(sourceString).digest('hex')
    //     let signature = request.headers['x-hubspot-signature']

    //     return hash == signature
    // }

    checkHubspotSignature(req, res, next) {

        let serverUrl = process.env.SERVER_URL
        let clientSecret = process.env.HS_CLIENT_SECRET
        let mode = process.env.MODE || 'dev'

        var httpURI = serverUrl + req.originalUrl;
        let bodyString = ''
        if (Object.keys(req.body).length > 0) {
            bodyString = JSON.stringify(req.body)
        }
        let sourceString = clientSecret + req.method + httpURI + bodyString

        let hash = crypto.createHash('sha256').update(sourceString).digest('hex')
        let signature = req.headers['x-hubspot-signature']
        console.log(sourceString)
        console.log(hash)
        console.log(signature)
        console.log(mode + ' : ' + (hash == signature))
        if (mode == 'dev' || hash == signature) {
            next()
        } else {
            res.status(401).send('401 Unauthorized HTTP responses')
        }

    }
}

exports.auth = new Auth()

