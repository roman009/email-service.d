const sgClient = require('@sendgrid/client')
const Firestore = require('@google-cloud/firestore')
require('dotenv').config()

const db = new Firestore({ projectId: process.env.GOOGLE_PROJECT_ID || 'email-service-d' })
sgClient.setApiKey(process.env.SENDGRID_API_KEY)

exports.sgClient = sgClient
exports.db = db

exports.processCheckRequest = async (pubSubEvent, context) => {
  console.log('Received checkRequest!')

  const startTime = Math.floor(((new Date()).getTime()) / 1000 - 36000)
  const requests = [
    {
      method: 'GET',
      url: `/v3/suppression/blocks?start_time=${startTime}`
    },
    {
      method: 'GET',
      url: `/v3/suppression/bounces?start_time=${startTime}`
    },
    {
      method: 'GET',
      url: `/v3/suppression/invalid_emails?start_time=${startTime}`
    },
    {
      method: 'GET',
      url: `/v3/suppression/spam_reports?start_time=${startTime}`
    }
  ]

  for (const request of requests) {
    await sgClient.request(request).then(this.processResponse)
  }
}

exports.processResponse = async ([response, body]) => {
  console.log('Response body: ' + response.body)
  if (response.body === undefined || response.body === '') {
    return false
  }
  const emailList = response.body
  for (const emailListItem of emailList) {
    const emailCheck = await db.collection('blocked_emails').doc(emailListItem.email).get()
    if (!emailCheck.exists) {
      const data = {
        created_at: (new Date()).getTime()
      }
      await db.collection('blocked_emails').doc(emailListItem.email).set(data)
      console.log('Email address added to block list!')
    }
  }

  return true
}
