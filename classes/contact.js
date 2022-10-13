const axios = require('axios')
const { auth } = require('./auth.js')
const { AOF } = require('./aof.js')
const { Owner } = require('./owner.js')
require('dotenv').config();
const base = 'https://api.hubapi.com'

let portal = process.env.PORTAL || 'production'


let ownersMax = 20
let associationTypeIdSubscribe = 186
let objectNameAof = '2-6107162'
if(portal == 'sandbox'){
    associationTypeIdSubscribe = 122
    objectNameAof = '2-8652219'
}


let Contact = class {

    essentialProps = [
        'firstname',
        'lastname',
        'email',
        'agent_private_contact',
        'hubspot_owner_id',
        'primary_contact_id',
        'primary_email',
        'ownership_requested_by'
    ]
    readonlyProps = [
        'hs_object_id',
    ]
    data = {}

    constructor() {
        for (let i = 1; i <= ownersMax; i++) {
            this.essentialProps.push('owner_' + i)
        }
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

            if (prop in this.data) {
                props[prop] = this.data[prop]
            }

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
    async addOwner(ownerId) {
        let hasExisted = false
        let availableIndex = 0
        for (let i = 1; i <= ownersMax; i++) {

            let id = this.data['owner_' + i]
            if (id == ownerId.toString()) {
                hasExisted = true
            }

            if (id == '' && availableIndex == 0) {
                availableIndex = i
            }
        }

        if (!hasExisted && availableIndex > 0) {
            this.data['owner_' + availableIndex] = ownerId
        }
        await this.save()

    }
    async subscribe(aof) {

        let config = await auth.getConfig()
        let canSubscribe = true

        //check if can subscribe
        let url = base + '/crm/v4/objects/contacts/' + this.data.hs_object_id + '/associations/'+objectNameAof
        let res = await axios.get(url,config)
        let results = res.data.results
        for(let i=0; i<results.length; i++){
            let associations = results[i]
            if(associations.toObjectId.toString() == aof.data.hs_object_id.toString()){
                let associationTypes = associations.associationTypes
                for(let j=0; j<associationTypes.length; j++){
                    let associationType = associationTypes[j]
                    if(associationType.label == 'Subscribed' || associationType.label == 'Unsubscribed'){
                        canSubscribe = false
                    }
                }
            }
            
        }
        
        console.log(aof.data.hs_object_id + '-' + canSubscribe)
        
        if(canSubscribe){
            let props = [
                {
                    "associationCategory": "USER_DEFINED",
                    "associationTypeId": associationTypeIdSubscribe
                }
            ]
            let url = base + '/crm/v4/objects/contacts/' + this.data.hs_object_id + '/associations/'+objectNameAof+'/' + aof.data.hs_object_id
            let res = await axios.put(url, props, config)

        }
        
 

    }

    async updateSubscription() {
        let config = await auth.getConfig()

        // let url = base + '/crm/v4/objects/contacts/' + this.data.hs_object_id + '/associations/2-6107162/'
        // let res = await axios.get(url, config)
        // let subscriptionAofIds = res.data.results.filter(el => {
        //     let associationTypes = el.associationTypes.filter(element => element.typeId == associationTypeIdSubscribe)
        //     return associationTypes.length > 0 ? true : false
        // })
        // .map(el => el.toObjectId)

        for (let i = 1; i <= ownersMax; i++) {
            let ownerId = this.data['owner_' + i]
            if (ownerId) {
                let owner = new Owner()
                let canLoad = await owner.loadById(ownerId)
                
                if(canLoad){
                    let aof = await AOF.search('emailaddress',owner.data.email)
                    if(aof){
                      await this.subscribe(aof)
                    }
                }

            }

        }

        return 'done'

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
    static async searchAllEmails(email) {
        let config = await auth.getConfig()
        let url = base + '/crm/v3/objects/contacts/search'
        let data = {
            "filterGroups": [
                {
                  "filters": [
                    {
                      "value": email,
                      "propertyName": "hs_additional_emails",
                      "operator": "CONTAINS_TOKEN"
                    }
                  ]
                },
                {
                  "filters": [
                    {
                      "value": email,
                      "propertyName": "email",
                      "operator": "EQ"
                    }
                  ]
                }
              ]
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

