# VK Helpers

A utility library for developing VK Mini Apps with support for both frontend and backend environments.

Most important features include:
- signature verification (backend)

## Installation

```bash
npm install vk-helpers
```

## Usage

### Frontend

```javascript
import { parseLaunchParams, getUserId, initBridge } from 'vk-helpers';

// Parse VK Mini App launch parameters
const params = parseLaunchParams();
console.log('User ID:', getUserId(params));
```

### Backend

```javascript
import { checkRequestSignature } from 'vk-helpers';

// Verify request signature
const isValid = checkRequestSignature({
  signature: 'received-signature',
  secretKey: 'your-secret-key',
  app_id: '12345',
  params: { param1: 'value1' },
  user_id: '67890',
  ts: '1234567890'
});
```

## Features

- Launch parameters parsing and validation
- Signature verification (backend)
- VK Bridge integration helpers
- Support for both ESM and CommonJS
```
