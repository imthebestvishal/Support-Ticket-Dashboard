import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function askAssistant(question) {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash",
    });

    const result = await model.generateContent([
      {
        text: `
You are an AI support assistant for a customer support dashboard.

Help the support agent with:
- ticket summaries
- reply suggestions
- troubleshooting steps
- customer support workflows

Question:
${question}
        `,
      },
    ]);

    return result.response.text();

  } catch (error) {
    console.error("Assistant service error:", error);
    throw error;
  }
}

