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
    data = {}
    constructor() {

    }

    async loadByUserId(userId) {
        let config = await auth.getConfig()

        try {
            let urlOwnerIDs = base + '/crm/v3/owners/' + userId + '?idProperty=userId'
            let res = await axios.get(urlOwnerIDs, config)
            this.data = res.data
            return true

        } catch (err) {
            return false
        }
    }
    async loadById(id) {
        let config = await auth.getConfig()
        try {
            let urlOwnerID = base + '/crm/v3/owners/' + id + '?idProperty=id'
            let res = await axios.get(urlOwnerID, config)
            this.data = res.data
            return true

        } catch (err) {
            return false
        }

    }

    async loadByEmail(email) {
        let config = await auth.getConfig()
        let urlOwner = base + '/crm/v3/owners/?email=' + email + '&limit=100&archived=false'
        let res = await axios.get(urlOwner, config)
        if (res.data.results.length > 0) {
            this.data = res.data.results[0]
            return true
        } else {
            return false
        }

    }


    async getPrivateContact(originalContactId) {
        let config = await auth.getConfig()

        let secondaryContactId
        let urlSsearch = base + '/crm/v3/objects/contacts/search'
        let data = {
            "filterGroups": [
                {
                    "filters": [
                        {
                            "propertyName": "hubspot_owner_id",
                            "operator": "EQ",
                            "value": this.data.id
                        },
                        {
                            "propertyName": "primary_contact_id",
                            "operator": "EQ",
                            "value": originalContactId
                        }
                    ]
                }
            ]
        }
        let resSearch = await axios.post(urlSsearch, data, config)
        // console.log(resSearch.data)
        if (resSearch.data.total == 0) { //create new secondary Contact for owner when not found
            return false
        } else {
            return resSearch.data.results[0].id
        }
    }

}

exports.Owner = Owner

