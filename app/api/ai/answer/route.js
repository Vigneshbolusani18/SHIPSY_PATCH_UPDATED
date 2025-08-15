// app/api/ai/answer/route.js

import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { findShipments, getVoyageDetails, getGeneralSummary } from "@/lib/ai-tools";

export const runtime = "nodejs";

// 1. Initialize the AI model client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 2. Define the available tools and map their names to the actual functions
const tools = {
  findShipments,
  getVoyageDetails,
  getGeneralSummary,
};

// 3. Create the detailed tool definitions for the AI model to understand
const toolDefinitions = [
  {
    functionDeclarations: [
      {
        name: "findShipments",
        description: "Finds shipments based on a city (origin or destination) and an optional status. Returns shipment details INCLUDING the associated voyageCode and vesselName.",
        parameters: {
          type: "OBJECT",
          properties: {
            city: { type: "STRING", description: "The city to search for, e.g., 'Mumbai', 'New York'." },
            status: { type: "STRING", description: "The shipment status to filter by. Can be 'in transit', 'delivered', 'created', or 'returned'." },
          },
          required: ["city"],
        },
      },
      {
        name: "getVoyageDetails",
        description: "Get detailed information about a specific voyage using its voyage code.",
        parameters: {
          type: "OBJECT",
          properties: {
            voyageCode: { type: "STRING", description: "The voyage code, e.g., 'VG-123'." },
          },
          required: ["voyageCode"],
        },
      },
      {
        name: "getGeneralSummary",
        description: "Get a high-level summary of all shipments and voyages, including total counts, statuses, etc. Use for general questions like 'how many shipments are there?'",
        parameters: { type: "OBJECT", properties: {} },
      },
    ],
  },
];

// 4. The main API route handler
export async function POST(req) {
  try {
    const { message } = await req.json();
    if (!message) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    // Configure the model to use our tools
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash", // Using a powerful, fast, and cost-effective model
      tools: toolDefinitions,
      toolConfig: { functionCallingConfig: { mode: "AUTO" } },
    });

    const chat = model.startChat();
    // Enhance the prompt with instructions for better formatting
    const result = await chat.sendMessage(
      `${message}\n\n(System instructions: If you are returning a list of items like shipments or voyages, please format the final answer as a markdown table for clarity.)`
    );

    const response = result.response;
    const functionCalls = response.functionCalls();

    if (functionCalls && functionCalls.length > 0) {
      // The AI decided to call one or more tools
      console.log("AI wants to call tools:", functionCalls.map(fc => fc.name));

      // Execute all tool calls in parallel for speed
      const toolResponses = await Promise.all(
        functionCalls.map(async (functionCall) => {
          const toolName = functionCall.name;
          const toolFn = tools[toolName];
          if (!toolFn) {
            throw new Error(`Unknown tool: ${toolName}`);
          }
          const args = functionCall.args;
          const data = await toolFn(args); // Execute the actual DB query
          return {
            functionResponse: {
              name: toolName,
              response: { content: JSON.stringify(data) },
            },
          };
        })
      );

      // Send the tool responses back to the model to get a final answer
      const finalResult = await chat.sendMessage(toolResponses);
      const finalResponseText = finalResult.response.text();
      return NextResponse.json({ text: finalResponseText });

    } else {
      // The AI answered directly without needing tools (e.g., for "hello")
      return NextResponse.json({ text: response.text() });
    }
  } catch (e) {
    console.error("POST /api/ai/answer error", e);
    return NextResponse.json({ error: e.message || "AI answer error" }, { status: 500 });
  }
}