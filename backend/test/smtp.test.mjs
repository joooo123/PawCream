import test from 'node:test'
import assert from 'node:assert/strict'
import net from 'node:net'

test('OTP mail is sent over SMTP to the supplied address, never returned in HTTP', async () => {
  let mail = ''
  let receiver = ''
  const smtp = net.createServer(socket => {
    socket.write('220 localhost ESMTP PawCream-test\r\n')
    let buffer = ''
    let inData = false
    socket.on('data', chunk => {
      buffer += chunk.toString('utf8')
      while (buffer.includes('\r\n')) {
        const i = buffer.indexOf('\r\n')
        const line = buffer.slice(0, i)
        buffer = buffer.slice(i + 2)
        if (inData) {
          if (line === '.') { inData = false; socket.write('250 2.0.0 queued\r\n') }
          else mail += line + '\r\n'
        } else if (/^EHLO |^HELO /i.test(line)) socket.write('250-localhost\r\n250 8BITMIME\r\n')
        else if (/^MAIL FROM:/i.test(line)) socket.write('250 2.1.0 OK\r\n')
        else if (/^RCPT TO:/i.test(line)) { receiver = line; socket.write('250 2.1.5 OK\r\n') }
        else if (/^DATA$/i.test(line)) { inData = true; socket.write('354 End data with <CR><LF>.<CR><LF>\r\n') }
        else if (/^QUIT$/i.test(line)) { socket.write('221 Bye\r\n'); socket.end() }
        else socket.write('250 OK\r\n')
      }
    })
  })
  await new Promise(resolve => smtp.listen(0, '127.0.0.1', resolve))
  try {
    process.env.SMTP_HOST = '127.0.0.1'
    process.env.SMTP_PORT = String(smtp.address().port)
    process.env.SMTP_SECURE = 'false'
    process.env.SMTP_FROM = 'PawCream <mailer@example.test>'
    delete process.env.SMTP_USER
    delete process.env.SMTP_PASS
    const { mailConfigured, sendVerificationMail } = await import('../src/registrationMail.js?test-smtp')
    assert.equal(mailConfigured(), true)
    await sendVerificationMail('newuser@example.test', '654321')
    assert.match(receiver, /newuser@example\.test/)
    assert.match(mail, /654321/)
  } finally {
    smtp.closeAllConnections()
    await new Promise(resolve => smtp.close(resolve))
  }
})
