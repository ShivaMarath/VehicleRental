const { createApp } = require('./app');

const port = process.env.PORT || 5000;
const { app } = createApp();
app.listen(port, '0.0.0.0', () => console.log(`Vehicle rental API listening on ${port}`));
