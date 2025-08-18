"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import Vapi from "@vapi-ai/web";

enum CallStatus {
    INACTIVE = "INACTIVE",
    CONNECTING = "CONNECTING",
    ACTIVE = "ACTIVE",
    FINISHED = "FINISHED",
}

interface SavedMessage {
    role: "user" | "system" | "assistant";
    content: string;
}

interface AgentProps {
    userName: string;
    userId: string;
    type?: string;
}


// Minimal shape for the message event so we don't use `any`
type TranscriptMessage = {
    type: string;
    transcriptType?: "final" | "partial";
    role?: "user" | "assistant" | "system";
    transcript?: string;
};

function isTranscriptMessage(m: unknown): m is TranscriptMessage {
    if (!m || typeof m !== "object") return false;
    const msg = m as Record<string, unknown>;
    return (
        typeof msg.type === "string" &&
        (msg.type === "transcript" || msg.type === "message") // SDK emits "transcript"
    );
}

type VapiClient = InstanceType<typeof Vapi>;

const Agent = ({ userName, userId }: AgentProps) => {
    const router = useRouter();
    const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);
    const [messages, setMessages] = useState<SavedMessage[]>([]);
    const [isSpeaking, setIsSpeaking] = useState(false);

    // Persist Vapi instance across renders
    const vapiRef = useRef<VapiClient | null>(null);

    useEffect(() => {
        // Create once on mount
        vapiRef.current = new Vapi(process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY!);
        const vapi = vapiRef.current;

        const onCallStart = () => setCallStatus(CallStatus.ACTIVE);
        const onCallEnd = () => setCallStatus(CallStatus.FINISHED);

        const onMessage = (message: unknown) => {
            if (!isTranscriptMessage(message)) return;
            if (message.type === "transcript" && message.transcriptType === "final") {
                const role =
                    (message.role as "user" | "assistant" | "system" | undefined) ??
                    "assistant";
                const content = message.transcript ?? "";
                if (content) {
                    setMessages((prev) => [...prev, { role, content }]);
                }
            }
        };

        const onSpeechStart = () => setIsSpeaking(true);
        const onSpeechEnd = () => setIsSpeaking(false);
        const onError = (error: unknown) => console.error("Vapi Error:", error);

        vapi.on("call-start", onCallStart);
        vapi.on("call-end", onCallEnd);
        vapi.on("message", onMessage);
        vapi.on("speech-start", onSpeechStart);
        vapi.on("speech-end", onSpeechEnd);
        vapi.on("error", onError);

        return () => {
            vapi.off("call-start", onCallStart);
            vapi.off("call-end", onCallEnd);
            vapi.off("message", onMessage);
            vapi.off("speech-start", onSpeechStart);
            vapi.off("speech-end", onSpeechEnd);
            vapi.off("error", onError);
        };
    }, []);

    useEffect(() => {
        if (callStatus === CallStatus.FINISHED) {
            router.push("/");
        }
    }, [callStatus, router]);

    const handleCall = async () => {
        setCallStatus(CallStatus.CONNECTING);
        const vapi = vapiRef.current;
        if (!vapi) return;

        // Ensure API key and assistant ID are valid
        if (!process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID) {
            console.error("VAPI assistant ID missing!");
            return;
        }

        try {
            // Only pass supported options
            await vapi.start(process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID!);
            setCallStatus(CallStatus.ACTIVE);
        } catch (error) {
            console.error("Failed to start Vapi:", error);
            setCallStatus(CallStatus.INACTIVE);
        }
    };

    const handleDisconnect = () => {
        setCallStatus(CallStatus.FINISHED);
        vapiRef.current?.stop();
    };

    const latestMessage = messages[messages.length - 1]?.content;
    const isCallInactiveOrFinished =
        callStatus === CallStatus.INACTIVE || callStatus === CallStatus.FINISHED;

    return (
        <>
            <div className="call-view">
                {/* AI Interviewer Card */}
                <div className="card-interviewer">
                    <div className="avatar">
                        <Image
                            src="/ai-avatar.png"
                            alt="profile-image"
                            width={65}
                            height={54}
                            className="object-cover"
                        />
                        {isSpeaking && <span className="animate-speak" />}
                    </div>
                    <h3>AI Interviewer</h3>
                </div>

                {/* User Profile Card */}
                <div className="card-border">
                    <div className="card-content">
                        <Image
                            src="/user-avatar.png"
                            alt="profile-image"
                            width={539}
                            height={539}
                            className="rounded-full object-cover size-[120px]"
                        />
                        <h3>{userName}</h3>
                    </div>
                </div>
            </div>

            {messages.length > 0 && (
                <div className="transcript-border">
                    <div className="transcript">
                        <p
                            key={latestMessage}
                            className={cn(
                                "transition-opacity duration-500 opacity-0",
                                "animate-fadeIn opacity-100"
                            )}
                        >
                            {latestMessage}
                        </p>
                    </div>
                </div>
            )}

            <div className="w-full flex justify-center">
                {callStatus !== CallStatus.ACTIVE ? (
                    <button className="relative btn-call" onClick={handleCall}>
            <span
                className={cn(
                    "absolute animate-ping rounded-full opacity-75",
                    callStatus !== CallStatus.CONNECTING && "hidden"
                )}
            />
                        <span className="relative">
              {isCallInactiveOrFinished ? "Call" : ". . ."}
            </span>
                    </button>
                ) : (
                    <button className="btn-disconnect" onClick={handleDisconnect}>
                        End
                    </button>
                )}
            </div>

            {/* Hidden audio element for Vapi */}
            <audio id="vapi-audio" autoPlay playsInline hidden />
        </>
    );
};

export default Agent;
