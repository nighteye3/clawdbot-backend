const app = require('./src/app');
const config = require('./src/config/env');

app.listen(config.PORT, () => {
    console.log(`ClawdProxy v3.0 (Tauri Compatible) running on port ${config.PORT}`);
    console.log(`Model: ${config.MODEL_NAME}`);
    console.log(`Memory Dir: ${config.MEMORY_DIR}`);
});
