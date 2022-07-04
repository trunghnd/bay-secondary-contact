const axios = require('axios')
const { auth } = require('./auth.js')
const base = 'https://api.hubapi.com'

let Owner = class {
    // data: {
    //     id: '163234306',
    //     email: 'trung.ly@hypeanddexter.nz',
    //     firstName: 'Trung',
    //     lastName: 'Ly',
    //     userId: 44128003,
    //     createdAt: '2022-03-29T03:38:29.199Z',
    //     updatedAt: '2022-06-29T07:52:38.105Z',
    //     archived: false
    // }
    constructor() {

    }

    async loadByUserId(userId) {

        let config = await auth.getConfig()
        let urlOwnerIDs = base + '/crm/v3/owners/' + userId + '?idProperty=userId'
        let res = await axios.get(urlOwnerIDs, config)
        this.data = res.data
    }


}

exports.Owner = Owner

