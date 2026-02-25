/**
 * Parses the raw response from WallStreetGPT.
 * The response usually contains Markdown text followed by a JSON block.
 */

export interface ParsedResponse {
    text: string;
    data: any | null;
    think?: string | null;
    isPartialData?: boolean; // New flag to indicate we detected partial data typing
}

export function parseResponse(raw: string): ParsedResponse {
    let textPart = raw;
    let dataPart = null;
    let thinkPart = null;
    let isPartialData = false;

    // 1. Extract <think> block
    const thinkRegex = /<think>([\s\S]*?)<\/think>/;
    const thinkMatch = textPart.match(thinkRegex);

    if (thinkMatch && thinkMatch[1]) {
        // Complete think block found
        thinkPart = thinkMatch[1].trim();
        textPart = textPart.replace(thinkMatch[0], '').trim();
    }
    else if (textPart.includes('<think>')) {
        // Partial think block found (Streaming)
        // Everything after <think> is considered think content until closed
        const split = textPart.split('<think>');
        // split[0] is preamble (mostly empty), split[1] is the partial think content
        if (split.length > 1) {
            thinkPart = split[1]!.trim();
            textPart = split[0]!.trim(); // Remove the think part from main text
        }
    }

    // 2. Extract JSON block (Complete)
    // It looks for ```json ... ```
    // We use dotAll (s flag) to match across newlines
    const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
    const jsonMatch = textPart.match(jsonRegex);

    if (jsonMatch) {
        const jsonString = jsonMatch[1] || '';
        // Remove the JSON block from text
        textPart = textPart.replace(jsonMatch[0], '').trim();

        try {
            dataPart = JSON.parse(jsonString);
        } catch (e) {
            console.error("Failed to parse JSON string in response:", e);
            // Fallback: If parsing fails, maybe we shouldn't have stripped it?
            // But usually this means it's malformed. 
            // We'll leave it stripped to avoid the "glitch" of re-appearing code.
            // Or strictly: textPart += jsonMatch[0] if we want to show it.
            // Given the user request "no glitch", hiding broken JSON is probably better than flashing it.
            // But let's act safe: if it fails, it might be just text code.
            // For now, let's keep it stripped to match previous behavior if it really looked like our data block.
        }
    } else {
        // 3. Handle Partial/Incomplete JSON Block (To fix glitch)

        // A. Check for unclosed ```json block (content streaming)
        // Matches ```json followed by anything until end of string
        const unclosedJsonRegex = /(```json[\s\S]*)$/;
        const unclosedMatch = textPart.match(unclosedJsonRegex);

        if (unclosedMatch) {
            textPart = textPart.replace(unclosedMatch[0], '').trim();
            isPartialData = true;
        } else {
            // B. Check for partial opening tag like ```, ```j, ```js (at the very end)
            // This prevents the flicker of backticks before 'json' is fully typed
            const partialTagRegex = /(```\s*(?:j(?:s(?:o(?:n)?)?)?)?)$/i;
            const partialTagMatch = textPart.match(partialTagRegex);

            if (partialTagMatch) {
                textPart = textPart.replace(partialTagMatch[0], '').trim();
                isPartialData = true;
            }
        }
    }

    // 4. Remove [Jawaban Langsung] specific tag
    // This is a specific request to hide this tag from the output
    const jawabanLangsungRegex = /\[Jawaban Langsung\]/gi;
    textPart = textPart.replace(jawabanLangsungRegex, '').trim();

    return {
        text: textPart,
        data: dataPart,
        think: thinkPart,
        isPartialData
    };
}
