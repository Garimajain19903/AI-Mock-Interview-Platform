import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";

export async function POST(request: Request) {
    const { type, role, level, techstack, amount, userid } = await request.json();

    try {
        console.log("API KEY loaded:", process.env.GOOGLE_API_KEY);

        const { text: questions } = await generateText({
            model: google("models/gemini-1.5-flash", {
                apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
            }),
            prompt: `Prepare questions for a job interview.
The job role is ${role}.
The job experience level is ${level}.
The tech stack used in the job is: ${techstack}.
The focus between behavioural and technical questions should lean towards: ${type}.
The amount of questions required is: ${amount}.
Please return only the questions, without any additional text.
The questions are going to be read by a voice assistant so do not use "/" or "*" or any other special characters which might break the voice assistant.
Return the questions formatted like this:
["Question 1", "Question 2", "Question 3"]`,
        });

        let parsedQuestions: string[] = [];
        try {
            parsedQuestions = JSON.parse(questions);
        } catch (err) {
            console.error("Failed to parse model response:", questions);
            throw new Error("Invalid response from AI model");
        }

        const interview = {
            role,
            type,
            level,
            techstack: techstack.split(","),
            questions: parsedQuestions,
            userId: userid,
            finalized: true,
            coverImage: getRandomInterviewCover(),
            createdAt: new Date().toISOString(),
        };

        await db.collection("interviews").add(interview);

        return Response.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error("Error:", error);
        return Response.json({ success: false, error }, { status: 500 });
    }
}

export async function GET() {
    return Response.json({ success: true, data: "Thank you!" }, { status: 200 });
}
