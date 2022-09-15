const axios = require('axios')
const { auth } = require('./auth.js')
require('dotenv').config();
const base = 'https://api.hubapi.com'
let portal = process.env.PORTAL || 'production'


let objectName = '2-6107162'
if(portal == 'sandbox'){
    objectName = '2-8652219'
}

let AOF = class {

    essentialProps = [
        'emailaddress',
    ]
    readonlyProps = [
        'hs_object_id',
    ]
    data = {}

    constructor() {
    }

    async load(id) {

        let config = await auth.getConfig()
        let props = this.essentialProps.concat(this.readonlyProps)
        let propList = props.join(',')
        let urlAOF = base + '/crm/v3/objects/'+objectName+'/' + id + '?properties=' + propList
        let res = await axios.get(urlAOF, config)

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

            if(prop in this.data){
                props[prop] = this.data[prop]
            }
            
        }

        let res
        if (!this.data.hs_object_id) {
            //insert
            let urlAOF = base + '/crm/v3/objects/'+objectName
            res = axios.post(urlAOF, { "properties": props }, config)
        } else {
            //update
            let urlAOF = base + '/crm/v3/objects/'+objectName+'/' + this.data.hs_object_id
            res = axios.patch(urlAOF, { "properties": props }, config)
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

    static async search(key, value, operator = 'EQ') {
        let config = await auth.getConfig()
        let url = base + '/crm/v3/objects/'+objectName+'/search'
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
        if (res.data.total >= 1) {
            let aofId = res.data.results[0]['id']
            let aof = new AOF()
            await aof.load(aofId)
            return aof
        } else {
            return false
        }

    }

}

exports.AOF = AOF

// let data = {
//     "results": [
//         {
//             "category": "USER_DEFINED",
//             "typeId": 184,
//             "label": "Unsubscribed"
//         },
//         {
//             "category": "USER_DEFINED",
//             "typeId": 186,
//             "label": "Subscribe"
//         },
//         {
//             "category": "USER_DEFINED",
//             "typeId": 40,
//             "label": null
//         }
//     ]
// }
