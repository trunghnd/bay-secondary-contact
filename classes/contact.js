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

    essentialProps = [
        'firstname',
        'lastname',
        'email',
        'agent_private_contact',
        'hubspot_owner_id',
        'primary_contact_id',
        'primary_email',
    ]
    readonlyProps = [
        'hs_object_id',
    ]
    data = {}

    constructor() {

    }

    async load(id) {

        let config = await auth.getConfig()
        // let urlContact = base + '/crm/v3/objects/contacts/'+id+'?properties=agent_private_contact,hubspot_owner_id,primary_contact_id,firstname,lastname'
        let props = this.essentialProps.concat(this.readonlyProps)
        let propList = props.join(',')
        let urlContact = base + '/crm/v3/objects/contacts/' + id + '?properties=' + propList
        let res = await axios.get(urlContact, config)

        this.data = res.data.properties
        for (let i = 0; i < props.length; i++) {
            let prop = props[i]
            if (this.data[prop] == null) { //checking for null or undefined
                this.data[prop] = ''
            }
        }


    }
    async save() {

        let config = await auth.getConfig()

        let props = {}
        for (let i = 0; i < this.essentialProps.length; i++) {
            let prop = this.essentialProps[i]
            props[prop] = this.data[prop]
        }

        let res
        if (!this.data.hs_object_id) {
            //insert
            let urlContact = base + '/crm/v3/objects/contacts'
            res = axios.post(urlContact, { "properties": props }, config)
        } else {
            //update
            let urlContact = base + '/crm/v3/objects/contacts/' + this.data.hs_object_id
            res = axios.patch(urlContact, { "properties": props }, config)
        }

        return res.then(payload => {
            this.data.hs_object_id = payload.data.id
            console.log(payload.data)
            return true
        }).catch(err => {
            console.log(err)
            return false
        })

    }
    async merge(vidToMerge) {
        //vidToMerge becomes subordinate
        let config = await auth.getConfig()

        let props = {
            "vidToMerge": vidToMerge
        }

        let urlContact = base + '/contacts/v1/contact/merge-vids/' + this.data.hs_object_id
        let res = axios.post(urlContact, props, config)


        return res.then(payload => {

            console.log(payload.data)
            return true
        }).catch(err => {
            console.log(err)
            return false
        })

    }

    static async search(key, value, operator = 'EQ') {

        let config = await auth.getConfig()
        let url = base + '/crm/v3/objects/contacts/search'
        let data = {
            "filterGroups": [
                {
                    "filters": [
                        {
                            "propertyName": key,
                            "operator": operator,
                            "value": value
                        }]
                }]
        }
        let res = await axios.post(url, data, config)
        console.log(res.data)
        if (res.data.total >= 1) {
            let contactId = res.data.results[0]['id']
            let contact = new Contact()
            await contact.load(contactId)
            return contact
        } else {
            return false
        }


    }
    static async searchComplex(filters) {
        let config = await auth.getConfig()
        let url = base + '/crm/v3/objects/contacts/search'
        let data = {
            "filterGroups": [
                {
                    "filters": filters
                }]
        }
        let res = await axios.post(url, data, config)
        if (res.data.total >= 1) {
            let contactId = res.data.results[0]['id']
            let contact = new Contact()
            await contact.load(contactId)
            return contact
        } else {
            return false
        }
    }


}

exports.Contact = Contact

