import http from 'http'

const data = JSON.stringify({ email: 'test@test.com', password: 'test123' })

const req = http.request('http://127.0.0.1:3002/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
}, (res) => {
  let s = ''
  res.on('data', c => s += c)
  res.on('end', () => {
    console.log('STATUS', res.statusCode)
    console.log('BODY', s)
  })
})
req.on('error', e => console.error('ERR', e.message))
req.write(data)
req.end()