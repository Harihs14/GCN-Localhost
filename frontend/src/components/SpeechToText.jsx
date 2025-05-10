import React, { useState, useEffect } from "react";
import { FaMicrophone, FaMicrophoneSlash } from "react-icons/fa";

const SpeechToText = ({ onTranscriptChange }) => {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");

  useEffect(() => {
    if (!("webkitSpeechRecognition" in window)) {
      alert("Sorry, your browser does not support speech recognition.");
      return;
    }

    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptSegment = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          setTranscript((prev) => prev + transcriptSegment);
          onTranscriptChange((prev) => prev + transcriptSegment);
        } else {
          interimTranscript += transcriptSegment;
        }
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
    };

    if (listening) {
      recognition.start();
    } else {
      recognition.stop();
    }

    return () => {
      recognition.stop();
    };
  }, [listening, onTranscriptChange]);

  const toggleListening = () => {
    setListening((prevState) => !prevState);
  };

  return (
    <button
      onClick={toggleListening}
      className={`bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-300 rounded-lg border border-zinc-700/50 hover:border-blue-400/30 text-xl p-2 transition-all duration-300 ${
        listening ? "text-blue-400 border-blue-400/30" : ""
      }`}
    >
      {listening ? <FaMicrophoneSlash /> : <FaMicrophone />}
    </button>
  );
};

export default SpeechToText;
