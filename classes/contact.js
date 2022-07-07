const axios = require('axios')
const { auth } = require('./auth.js')
const base = 'https://api.hubapi.com'

let Contact = class {
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

    async load(id) {

        let config = await auth.getConfig()
        let urlContact = base + '/crm/v3/objects/contacts/'+id+'?properties=agent_private_contact,hubspot_owner_id,primary_contact_id,firstname,lastname'
        let res = await axios.get(urlContact, config)
        this.data = res.data.properties
        console.log(this.data)
    }


}

exports.Contact = Contact

