import { parseResponse } from './src/utils/responseParser.ts';

// Mocking the streaming process
const fullResponse = `Here is the stock data:
\`\`\`json
{
  "symbol": "V",
  "price": 250.00,
  "history": [
    { "date": "2024-01-01", "close": 240 },
    { "date": "2024-01-08", "close": 245 }
  ]
}
\`\`\`
`;

const chunks = fullResponse.split('');
let currentStream = '';

console.log("Starting stream simulation...");

for (const char of chunks) {
    currentStream += char;
    const result = parseResponse(currentStream);

    // Check if we see any JSON characters in the text part when we shouldn't
    if (result.text.includes('```') || result.text.includes('{') && result.isPartialData) {
        // Allow { if it's just text, but here we expect data to be hidden if it's partial
    }

    // specifically check if the opening ```json leaks OR just ``` leaks at the end
    if (result.text.includes('```')) {
        console.log("GLITCH DETECTED! Text contains ```");
        console.log("Current Stream:", currentStream);
        console.log("Parsed Text:", result.text);
        // Don't break immediately, let's see how long it lasts
    }
}

console.log("Simulation finished.");
