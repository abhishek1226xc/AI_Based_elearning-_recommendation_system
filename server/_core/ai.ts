import axios from "axios";
import { ENV } from "./env";

export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * AI Service - Integrates with OpenAI, Groq, or other API providers
 * Provides intelligent course recommendations and learning guidance
 */

export class AIService {
  private openaiKey = process.env.OPENAI_API_KEY;
  private groqKey = process.env.GROQ_API_KEY;
  private anthropicKey = process.env.ANTHROPIC_API_KEY;

  /**
   * Generate AI response using OpenAI GPT
   */
  async generateWithOpenAI(messages: AIMessage[]): Promise<string> {
    if (!this.openaiKey || this.openaiKey.startsWith("sk-your")) {
      throw new Error("OpenAI API key not configured. Please add OPENAI_API_KEY to .env");
    }

    try {
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-3.5-turbo",
          messages: messages,
          temperature: 0.7,
          max_tokens: 1000,
        },
        {
          headers: {
            Authorization: `Bearer ${this.openaiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data.choices[0].message.content;
    } catch (error: any) {
      console.error("OpenAI API error:", error.response?.data || error.message);
      throw new Error("Failed to get AI response from OpenAI");
    }
  }

  /**
   * Generate AI response using Groq (faster, free tier available)
   */
  async generateWithGroq(messages: AIMessage[]): Promise<string> {
    if (!this.groqKey || this.groqKey === "") {
      throw new Error("Groq API key not configured");
    }

    try {
      const response = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: "mixtral-8x7b-32768",
          messages: messages,
          temperature: 0.7,
          max_tokens: 1000,
        },
        {
          headers: {
            Authorization: `Bearer ${this.groqKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data.choices[0].message.content;
    } catch (error: any) {
      console.error("Groq API error:", error.response?.data || error.message);
      throw new Error("Failed to get AI response from Groq");
    }
  }

  /**
   * Generate AI response using Anthropic Claude
   */
  async generateWithAnthropic(messages: AIMessage[]): Promise<string> {
    if (!this.anthropicKey || this.anthropicKey === "") {
      throw new Error("Anthropic API key not configured");
    }

    try {
      // Anthropic uses a separate `system` parameter instead of system messages
      const systemParts = messages.filter(m => m.role === "system").map(m => m.content);
      const systemPrompt = systemParts.length > 0
        ? systemParts.join("\n")
        : "You are an expert educational AI assistant helping users find the perfect online courses. Provide detailed, personalized course recommendations based on their learning goals, skill level, and interests.";
      const conversationMessages = messages.filter(m => m.role !== "system");

      const response = await axios.post(
        "https://api.anthropic.com/v1/messages",
        {
          model: "claude-3-sonnet-20240229",
          max_tokens: 1000,
          system: systemPrompt,
          messages: conversationMessages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        },
        {
          headers: {
            "x-api-key": this.anthropicKey,
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01",
          },
        }
      );

      return response.data.content[0].text;
    } catch (error: any) {
      console.error("Anthropic API error:", error.response?.data || error.message);
      throw new Error("Failed to get AI response from Anthropic");
    }
  }

  /**
   * Main method - tries OpenAI first, then falls back
   */
  async generateResponse(messages: AIMessage[]): Promise<string> {
    // Try OpenAI first (most reliable)
    if (this.openaiKey && !this.openaiKey.startsWith("sk-your")) {
      try {
        return await this.generateWithOpenAI(messages);
      } catch (error) {
        console.error("OpenAI failed, trying fallback:", error);
      }
    }

    // Try Groq (free tier available)
    if (this.groqKey && this.groqKey !== "") {
      try {
        return await this.generateWithGroq(messages);
      } catch (error) {
        console.error("Groq failed, trying fallback:", error);
      }
    }

    // Try Anthropic
    if (this.anthropicKey && this.anthropicKey !== "") {
      try {
        return await this.generateWithAnthropic(messages);
      } catch (error) {
        console.error("Anthropic failed:", error);
      }
    }

    throw new Error(
      "No AI service configured. Please add OPENAI_API_KEY, GROQ_API_KEY, or ANTHROPIC_API_KEY to .env"
    );
  }
}

export const aiService = new AIService();
