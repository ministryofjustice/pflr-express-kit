module.exports = (...msg) => {
  if (!process.env.ENV) {
    console.log(msg.join(' '))
  }
}
