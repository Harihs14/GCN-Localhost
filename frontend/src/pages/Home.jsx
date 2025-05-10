import React, { useState, useRef, useEffect } from "react";
import {
  FaPaperPlane,
  FaSpinner,
  FaBook,
  FaFileAlt,
  FaTrash,
  FaCopy,
  FaPlus,
  FaTimes,
  FaUser,
  FaSignOutAlt,
  FaMemory,
  FaComments,
  FaStar,
  FaRegStar,
  FaSearch,
  FaRegCommentDots,
} from "react-icons/fa";
import { RiChatNewLine, RiSearchLine, RiMenu3Line } from "react-icons/ri";
import StyledMarkdown from "../components/StyledMarkdown";
import logo from "../assets/wlogo.png";
import Image from "../components/Image";
import { BsGlobe2 } from "react-icons/bs";
import { AiOutlinePlus } from "react-icons/ai";
import SpeechToText from "../components/SpeechToText";
import TextToSpeech from "../components/TextToSpeech";
import { SiBookstack } from "react-icons/si";
import ProductModal from "../components/ProductModal";
import DocumentModal from "../components/DocumentModal";
import RelevantDefaultQueries from "../components/RelevantDefaultQueries";
import { motion } from "framer-motion";
import { API_BASE_URL } from "../config";
import { logout } from "../components/AuthGuard";
import { QueryResultSkeleton } from "../components/SkeletonLoaders";

const Home = () => {
  // Local definition of SAMPLE_QUERIES to ensure it's available
  const SAMPLE_QUERIES = [
    "What are the key principles of the Agile Manifesto?",
    "How does MISRA compliance affect automotive software development?",
    "What are the main components of ISO 27001 Information Security Management System?",
    "What software lifecycle processes are defined in ISO/IEC/IEEE 12207?",
    "How does IEC 62304 classify medical device software?",
    "What quality characteristics are defined in ISO/IEC 25010?",
    "What is the relationship between ISO 9001 and ISO/IEC/IEEE 90003?",
    "What test documentation is required according to IEEE 829?",
    "How does ISO/IEC 20000 relate to ITIL?",
    "What are the key test techniques in ISO/IEC/IEEE 29119-4?",
    "Compare the software quality models in ISO 25010 and IEEE 730",
    "How to implement MISRA compliance in an automotive project?",
    "What documentation is required for medical device software under IEC 62304?",
    "How to integrate agile methods with ISO 12207 processes?",
    "What are the key differences between ISO 27001:2013 and previous versions?",
  ];

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [results, setResults] = useState(null);
  const [recentQueries, setRecentQueries] = useState([]);
  const [showVideos, setShowVideos] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [chatList, setChatList] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const inputRef = useRef(null);
  const [chatTab, setChatTab] = useState(false);
  const [url, setUrl] = useState("");
  const [metadata, setMetadata] = useState({});
  const [text, setText] = useState("");
  const [chatName, setChatName] = useState("New Chat");
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const textareaRef = useRef(null);
  const [error, setError] = useState(null);
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);
  const [loadedImages, setLoadedImages] = useState({});
  const [imageErrors, setImageErrors] = useState({});
  const [randomQueries, setRandomQueries] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [userId, setUserId] = useState(null);
  const [username, setUsername] = useState("");
  const [processingSteps, setProcessingSteps] = useState({
    sending: false,
    analyzing: false,
    retrieving: false,
    generating: false,
    complete: false,
  });

  const handleFetch = async () => {
    const data = await fetchMetadata(url);
    setMetadata(data);
  };

  useEffect(() => {
    const savedQueries = JSON.parse(
      localStorage.getItem("recentQueries") || "[]"
    );
    setRecentQueries(savedQueries);

    // Get user info from localStorage
    const storedUserId = localStorage.getItem("userId");
    const storedUsername = localStorage.getItem("username");

    if (!storedUserId) {
      // Redirect to login if no user ID is found
      window.location.href = "/";
      return;
    }

    setUserId(storedUserId);
    setUsername(storedUsername || "User");

    fetchChatList(storedUserId);
  }, []);

  useEffect(() => {
    const fetchMetadataWithDelay = async (link, index) => {
      // Add delay based on index to prevent rate limiting
      await new Promise((resolve) => setTimeout(resolve, index * 1000));
      if (!metadata[link]) {
        await fetchMetadata(link);
      }
    };

    chatMessages.forEach((msg) => {
      if (msg.online_links) {
        msg.online_links.forEach((link, index) => {
          fetchMetadataWithDelay(link, index);
        });
      }
    });
  }, [chatMessages]);

  useEffect(() => {
    // Fetch products once userId is available
    if (userId) {
      fetchProducts();
    }
  }, [userId]);

  useEffect(() => {
    // Select 3 random queries from the SAMPLE_QUERIES array
    const getRandomQueries = () => {
      const shuffled = [...SAMPLE_QUERIES].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, 3);
    };

    setRandomQueries(getRandomQueries());
  }, []);

  const fetchChatList = async (userIdParam) => {
    try {
      const currentUserId = userIdParam || userId;
      if (!currentUserId) return null;

      const response = await fetch(
        `${API_BASE_URL}/chat-list?userId=${currentUserId}`
      );
      if (!response.ok) throw new Error("Failed to fetch chat list");
      const data = await response.json();
      setChatList(data);
      return data;
    } catch (error) {
      console.error("Error fetching chat list:", error);
      return null;
    }
  };

  const deleteChat = async (chatId) => {
    try {
      if (!userId) return;

      const response = await fetch(
        `${API_BASE_URL}/chat?chatId=${encodeURIComponent(
          chatId
        )}&userId=${userId}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Failed to delete chat");
      }

      // Update local state immediately
      setChatList((prevList) =>
        prevList.filter((chat) => chat.chat_id !== chatId)
      );

      // If we're deleting the currently selected chat
      if (selectedChat?.chat_id === chatId) {
        setSelectedChat(null);
        setChatMessages([]);
        setResults(null);
        setChatName("New Chat");

        // Try to select the next available chat
        const remainingChats = await fetchChatList();
        if (remainingChats?.length > 0) {
          await selectChat(remainingChats[0]);
        }
      }
    } catch (error) {
      console.error("Error deleting chat:", error);
      // Refresh the chat list to ensure UI is in sync with server
      fetchChatList();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Show skeleton loader immediately
    setShowSkeleton(true);

    if (!query.trim()) {
      setError("Please enter a query");
      setShowSkeleton(false);
      return;
    }

    if (!userId) {
      setError("You must be logged in to continue");
      setShowSkeleton(false);
      return;
    }

    try {
      // Set loading state
      setLoading(true);
      setError(null);

      console.log("Sending query to:", `${API_BASE_URL}/query`);

      // Create an AbortController with a longer timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout (300 seconds)

      // Start request timer
      const requestStartTime = performance.now();

      // Make API request with userId
      const response = await fetch(`${API_BASE_URL}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query,
          org_query: query,
          chat_id: selectedChat?.chat_id,
          userId: userId,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Calculate request time
      const requestTime = performance.now() - requestStartTime;
      console.log(`Request completed in ${requestTime}ms`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("Received response data:", data);

      // Ensure we have related_queries even if the server doesn't provide them
      if (!data.related_queries || !Array.isArray(data.related_queries)) {
        data.related_queries = [];
      }

      // Normalize related_queries to ensure they're all in object format
      data.related_queries = data.related_queries.map((item) => {
        if (typeof item === "string") {
          return { query: item, context: "Generated suggestion" };
        }
        return item;
      });

      // Ensure we have pdf_references even if the server doesn't provide them
      if (!data.pdf_references) {
        data.pdf_references = [];
      }

      // Update results and hide skeleton
      setResults(data);
      setQuery("");
      setShowSuggestions(false);
      setShowSkeleton(false);

      // Store recent queries
      const newRecentQueries = [query, ...(recentQueries || [])].slice(0, 5);
      setRecentQueries(newRecentQueries);
      localStorage.setItem("recentQueries", JSON.stringify(newRecentQueries));

      // Update chat messages
      const newMessages = [
        ...(chatMessages || []),
        {
          query: query,
          answer: data.answer,
          pdf_references: data.pdf_references,
          online_images: data.online_images || [],
          online_videos: data.online_videos || [],
          online_links: data.online_links || [],
          relevant_queries: data.related_queries,
        },
      ];
      setChatMessages(newMessages);

      // Update selected chat and chat list
      if (data.chatId) {
        const chatExists = chatList.some(
          (chat) => chat.chat_id === data.chatId
        );

        if (!chatExists) {
          const newChat = {
            chat_id: data.chatId,
            name: data.chat_name,
            query: query,
            answer: data.answer,
          };
          setChatList([newChat, ...chatList]);
        }

        setSelectedChat({
          chat_id: data.chatId,
          name: data.chat_name,
        });
        setChatName(data.chat_name);
      }
    } catch (error) {
      console.error("Error submitting query:", error);
      setError(
        error.message === "The user aborted a request."
          ? "Request timed out. Please try again."
          : error.message
      );
      setShowSkeleton(false);
    } finally {
      setLoading(false);
    }
  };

  const selectChat = async (chat) => {
    setSelectedChat(chat);
    setChatName(chat.name);
    setResults(null);
    await fetchChatHistory(chat.chat_id);
  };

  const fetchChatHistory = async (chatId) => {
    try {
      if (!userId) return;

      const response = await fetch(
        `${API_BASE_URL}/chat-history/${chatId}?userId=${userId}`
      );
      if (!response.ok) throw new Error("Failed to fetch chat history");
      const data = await response.json();
      setChatMessages(data);
    } catch (error) {
      console.error("Error fetching chat history:", error);
    }
  };

  const fetchMetadata = async (url) => {
    try {
      // Use our backend proxy endpoint
      const proxyUrl = `${API_BASE_URL}/proxy?url=${encodeURIComponent(url)}`;

      try {
        const response = await fetch(proxyUrl);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const text = await response.text();
        const doc = new DOMParser().parseFromString(text, "text/html");

        const metadata = {
          title:
            doc.querySelector("title")?.innerText ||
            doc.querySelector('meta[property="og:title"]')?.content ||
            "Unknown Title",
          description:
            doc.querySelector('meta[name="description"]')?.content ||
            doc.querySelector('meta[property="og:description"]')?.content ||
            "No description available",
          image:
            doc.querySelector('meta[property="og:image"]')?.content || null,
        };

        // Cache the metadata
        setMetadata((prev) => ({
          ...prev,
          [url]: metadata,
        }));

        return metadata;
      } catch (proxyError) {
        console.warn(`Proxy failed:`, proxyError);

        // Fall back to basic metadata
        const fallbackMetadata = {
          title: new URL(url).hostname,
          description: "Content not accessible. Try opening the link directly.",
          image: null,
        };

        setMetadata((prev) => ({
          ...prev,
          [url]: fallbackMetadata,
        }));

        return fallbackMetadata;
      }
    } catch (error) {
      console.error("Error fetching metadata for", url, error);
      // Return basic metadata from URL
      const fallback = {
        title: new URL(url).hostname,
        description: "Unable to fetch content",
        image: null,
      };
      setMetadata((prev) => ({
        ...prev,
        [url]: fallback,
      }));
      return fallback;
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        console.log("Text copied to clipboard!");
      })
      .catch((err) => {
        console.error("Failed to copy text: ", err);
      });
  };

  const handleTranscriptChange = (newTranscript) => {
    setQuery(newTranscript);
    inputRef.current.value = newTranscript;
  };

  const handleQueryChange = (e) => {
    const newValue = e.target.value;
    setQuery(newValue);

    // Adjust textarea height
    e.target.style.height = "auto";
    e.target.style.height =
      Math.min(Math.max(e.target.scrollHeight, 48), 96) + "px";

    // Handle @ mentions with improved detection
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = newValue.slice(0, cursorPosition);
    const match = textBeforeCursor.match(/@([^\s]*)$/); // Updated regex pattern

    if (match && products.length > 0) {
      // Added products length check
      const searchTerm = match[1].toLowerCase();
      const filtered = products.filter((p) =>
        p.title.toLowerCase().includes(searchTerm)
      );
      setFilteredProducts(filtered);
      setShowSuggestions(true);
      setSuggestionIndex(0);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSuggestionIndex((prev) =>
          prev < filteredProducts.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSuggestionIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
        if (showSuggestions && filteredProducts.length > 0) {
          e.preventDefault();
          insertProduct(filteredProducts[suggestionIndex]);
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        break;
      case "@":
        // Show all products when @ is typed
        setFilteredProducts(products);
        setShowSuggestions(true);
        setSuggestionIndex(0);
        break;
      default:
        break;
    }
  };

  const insertProduct = (product) => {
    const cursorPosition = textareaRef.current.selectionStart;
    const textBeforeCursor = query.slice(0, cursorPosition);
    const textAfterCursor = query.slice(cursorPosition);
    const lastAtSign = textBeforeCursor.lastIndexOf("@");

    const newText =
      textBeforeCursor.slice(0, lastAtSign) +
      `@${product.title} ` +
      textAfterCursor;

    setQuery(newText);
    setShowSuggestions(false);

    // Focus back on textarea and move cursor to end of inserted text
    textareaRef.current.focus();
    const newCursorPosition = lastAtSign + product.title.length + 2; // +2 for @ and space
    setTimeout(() => {
      textareaRef.current.setSelectionRange(
        newCursorPosition,
        newCursorPosition
      );
    }, 0);
  };

  const handleImageLoad = (imageUrl) => {
    setLoadedImages((prev) => ({
      ...prev,
      [imageUrl]: true,
    }));
  };

  const handleImageError = (imageUrl) => {
    setImageErrors((prev) => ({
      ...prev,
      [imageUrl]: true,
    }));
  };

  const handleLogout = () => {
    logout();
  };

  // Fetch products from API
  const fetchProducts = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/products?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  // Open product modal
  const openProductModal = () => {
    if (!userId) {
      setError("You must be logged in to create products");
      return;
    }
    setIsProductModalOpen(true);
  };

  // Handle product submit
  const handleProductSubmit = async (productData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...productData,
          userId: userId,
        }),
      });
      if (response.ok) {
        const newProduct = await response.json();
        setProducts((prev) => [newProduct, ...prev]);
        setIsProductModalOpen(false);
      }
    } catch (error) {
      console.error("Error creating product:", error);
    }
  };

  // Delete product
  const handleDeleteProduct = async (productId) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/products/${productId}?userId=${userId}`,
        {
          method: "DELETE",
        }
      );
      if (response.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== productId));
      }
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  };

  // Update product
  const handleUpdateProduct = async (productId, updatedData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...updatedData,
          userId: userId,
        }),
      });
      if (response.ok) {
        const updatedProduct = await response.json();
        setProducts((prev) =>
          prev.map((p) => (p.id === productId ? updatedProduct : p))
        );
      }
    } catch (error) {
      console.error("Error updating product:", error);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-b from-zinc-900 to-black text-white font-poppins">
      <header className="bg-zinc-900/70 backdrop-blur-lg border-b border-blue-500/20 sticky top-0 z-50 shadow-xl">
        <div className="container mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4 flex flex-wrap sm:flex-nowrap justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="h-8 w-8 sm:h-10 sm:w-10" />
            <p className="text-xl sm:text-2xl font-semibold text-blue-400">
              GCN
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-end">
            <button
              onClick={() => setIsDocumentModalOpen(true)}
              className="flex items-center gap-1 sm:gap-2 bg-zinc-800/80 hover:bg-zinc-700/80 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-all duration-300 border border-blue-500/30 shadow-lg hover:shadow-blue-500/20 text-xs sm:text-sm"
            >
              <FaFileAlt size={14} className="text-blue-400" />
              <span className="font-medium">Manage Documents</span>
            </button>
            <button
              onClick={openProductModal}
              className="flex items-center gap-1 sm:gap-2 bg-zinc-800/80 hover:bg-zinc-700/80 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-all duration-300 border border-blue-500/30 shadow-lg hover:shadow-blue-500/20 text-xs sm:text-sm"
            >
              <FaBook size={14} className="text-blue-400" />
              <span className="font-medium">Add Product</span>
            </button>
            <button
              onClick={() => setChatTab(!chatTab)}
              className="md:hidden flex items-center justify-center bg-zinc-800/80 hover:bg-zinc-700/80 p-2 rounded-lg transition-all duration-300 shadow-lg border border-blue-500/20"
              title="Toggle Sidebar"
            >
              <RiMenu3Line className="text-blue-400" />
            </button>
          </div>
        </div>
      </header>

      {/* Left fixed menu - only visible on desktop */}
      <div
        className={`fixed ${
          chatTab ? "md:left-[310px] left-4" : "left-4"
        } top-20 z-40 hidden md:flex flex-col gap-3 transition-all duration-500`}
      >
        <button
          onClick={() => setChatTab(!chatTab)}
          className="flex items-center justify-center bg-zinc-800/80 hover:bg-zinc-700/80 p-3 rounded-lg transition-all duration-300 shadow-lg border border-blue-500/20"
          title="Toggle Sidebar"
        >
          <RiMenu3Line className="text-blue-400" />
        </button>
        <button
          onClick={() => {
            setSelectedChat(null);
            setChatMessages([]);
            setResults(null);
            setChatName("New Chat");
            setQuery("");
          }}
          className="flex items-center justify-center bg-zinc-800/80 hover:bg-zinc-700/80 p-3 rounded-lg transition-all duration-300 shadow-lg border border-blue-500/20"
          title="New Chat"
        >
          <RiChatNewLine className="text-blue-400" />
        </button>
      </div>

      <div className="flex flex-row">
        {/* Mobile overlay when sidebar is open */}
        {chatTab && (
          <div
            className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-20"
            onClick={() => setChatTab(false)}
          ></div>
        )}

        {/* Sidebar with animated transitions */}
        <aside
          style={{
            width: chatTab ? "300px" : "0px",
            transform: chatTab ? "translateX(0)" : "translateX(-300px)",
            opacity: chatTab ? 1 : 0,
            transition: "all 0.5s ease-in-out",
          }}
          className="fixed left-0 top-0 h-screen overflow-clip bg-zinc-800/90 border-r border-blue-500/30 text-white z-30 pt-16 shadow-2xl"
        >
          <button
            className="md:hidden absolute top-20 right-4 p-2 rounded-full bg-zinc-800/90 text-blue-400"
            onClick={() => setChatTab(false)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          <div className="h-[calc(100vh-5rem)] p-4 sm:p-5 mt-5 overflow-y-auto flex flex-col custom-scrollbar">
            {/* Improved header with icon */}
            <div className="mb-6 flex-shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-blue-500/20 rounded-md">
                  <FaComments className="text-blue-400 text-lg" />
                </div>
                <h2 className="text-xl font-semibold text-gray-200">
                  Your Conversations
                </h2>
              </div>
              <div className="h-1 w-full bg-gradient-to-r from-blue-500/80 to-blue-500/10 rounded-full"></div>
            </div>

            {/* Enhanced New Chat button */}
            <button
              onClick={() => {
                setSelectedChat(null);
                setChatMessages([]);
                setResults(null);
                setChatName("New Chat");
                setQuery("");
              }}
              className="w-full flex items-center justify-between gap-2 py-3 px-4 mb-6 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-white transition-all duration-300 border border-blue-500/30 shadow-lg group"
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-blue-500/30 rounded-md group-hover:bg-blue-500/40 transition-all">
                  <RiChatNewLine className="text-blue-300" />
                </div>
                <span className="font-medium text-sm">New Conversation</span>
              </div>
              <div className="bg-blue-500/30 rounded-md p-1 opacity-0 group-hover:opacity-100 transition-all">
                <FaPlus size={10} className="text-blue-300" />
              </div>
            </button>

            {/* Search box for chats */}
            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Search conversations..."
                className="w-full bg-zinc-700/30 border border-zinc-600/50 rounded-lg py-2 pl-9 pr-4 text-sm text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50"
                onChange={(e) => setSearchQuery(e.target.value)}
                value={searchQuery || ""}
              />
              <RiSearchLine className="absolute left-3 top-2.5 text-gray-400 text-sm" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-200"
                >
                  <FaTimes size={12} />
                </button>
              )}
            </div>

            {/* Filter tabs */}
            <div className="flex mb-4 border-b border-zinc-700/50 pb-1">
              <button
                onClick={() => setActiveFilter("All")}
                className={`flex-1 text-xs font-medium py-1.5 px-2 rounded-t-md transition-all ${
                  activeFilter === "All"
                    ? "text-blue-300 border-b-2 border-blue-500"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveFilter("Recent")}
                className={`flex-1 text-xs font-medium py-1.5 px-2 rounded-t-md transition-all ${
                  activeFilter === "Recent"
                    ? "text-blue-300 border-b-2 border-blue-500"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                Recent
              </button>
            </div>

            {/* Enhanced Chat list with hover effects */}
            <div className="space-y-2.5">
              {(searchQuery
                ? chatList.filter((chat) =>
                    chat.name?.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                : activeFilter === "Recent"
                ? chatList.slice(0, 5)
                : chatList
              ).map((chat) => (
                <div
                  key={chat.chat_id}
                  className={`flex justify-between text-left border rounded-lg transition-all duration-200 overflow-hidden ${
                    selectedChat?.chat_id === chat.chat_id
                      ? "bg-blue-900/40 border-blue-500/50 shadow-md"
                      : "bg-zinc-800/40 hover:bg-zinc-700/50 border-zinc-700/50 hover:border-blue-500/30"
                  }`}
                >
                  <button
                    className="flex-1 text-left flex items-center gap-3 p-3"
                    onClick={() => selectChat(chat)}
                  >
                    <div className="flex flex-col items-center justify-center">
                      <div className="flex gap-1 mb-1">
                        {chat.product_colors &&
                          chat.product_colors.map((product, idx) => (
                            <div
                              key={`${chat.chat_id}-${product.id}-${idx}`}
                              className={`w-2 h-2 rounded-full bg-${product.color}-500 animate-pulse`}
                              title={product.title}
                            />
                          ))}
                        {selectedChat?.chat_id === chat.chat_id && (
                          <div
                            className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"
                            title="Memory Active"
                          />
                        )}
                      </div>
                      <div className="text-xs text-gray-400">
                        {chat.updated_at
                          ? new Date(chat.updated_at).toLocaleDateString()
                          : ""}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div
                        className="font-medium text-sm text-gray-200 line-clamp-1 mb-1"
                        title={chat.name || "Unnamed Chat"}
                      >
                        {chat.name?.slice(0, 25).replace(`"`, ``) ||
                          "Unnamed Chat"}
                      </div>
                      <div className="text-xs text-gray-400 line-clamp-1">
                        {chat.query?.slice(0, 30) + "..." || "No messages yet"}
                      </div>
                    </div>
                  </button>
                  <div className="flex flex-col">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteChat(chat.chat_id);
                      }}
                      className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <FaTrash size={14} />
                    </button>
                  </div>
                </div>
              ))}

              {/* Empty state when no chats match filter */}
              {chatList.length === 0 && (
                <div className="text-center py-8 px-3">
                  <div className="bg-zinc-800/40 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                    <FaRegCommentDots className="text-gray-400 text-xl" />
                  </div>
                  <p className="text-gray-400 text-sm">No conversations yet</p>
                  <p className="text-gray-500 text-xs mt-1">
                    Start a new chat to begin
                  </p>
                </div>
              )}

              {/* Empty search results */}
              {searchQuery &&
                chatList.filter((chat) =>
                  chat.name?.toLowerCase().includes(searchQuery.toLowerCase())
                ).length === 0 && (
                  <div className="text-center py-6 px-3">
                    <div className="bg-zinc-800/40 rounded-full w-10 h-10 flex items-center justify-center mx-auto mb-2">
                      <FaSearch className="text-gray-400 text-sm" />
                    </div>
                    <p className="text-gray-400 text-sm">No results found</p>
                    <p className="text-gray-500 text-xs mt-1">
                      Try a different search term
                    </p>
                  </div>
                )}
            </div>

            {/* Footer with user info */}
            <div className="mt-auto pt-4 border-t border-zinc-700/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <FaUser className="text-blue-400 text-xs" />
                </div>
                <div>
                  <div className="text-sm text-gray-300">
                    {username || "User"}
                  </div>
                  <div className="text-xs text-gray-500">ID: {userId}</div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                title="Logout"
              >
                <FaSignOutAlt size={14} />
              </button>
            </div>
          </div>
        </aside>

        {/* Main content area with responsive padding */}
        <main
          className={`w-full pb-6 px-2 sm:px-4 flex flex-col items-center transition-all duration-500 ${
            chatTab ? "md:ml-[300px]" : "ml-0"
          }`}
        >
          <div className="w-full max-w-7xl mx-auto rounded-lg">
            <div className="p-2 sm:p-4">
              <div className="h-[calc(100vh-15rem)] sm:h-[calc(100vh-13rem)] overflow-y-auto custom-scrollbar">
                {/* Show welcome screen when no messages and not loading */}
                {!showSkeleton && chatMessages.length === 0 ? (
                  <div className="flex flex-col justify-center items-center h-full px-4">
                    <div className="flex flex-row gap-3 items-center select-none mb-6 sm:mb-8">
                      <img
                        src={logo || "/placeholder.svg"}
                        className="h-20 sm:h-28 select-none"
                        alt="GCN Logo"
                      />
                      <p className="text-4xl sm:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-l from-blue-500 via-sky-300 to-blue-500 font-unbound">
                        GCN
                      </p>
                    </div>
                    <p className="text-lg sm:text-xl mb-6 sm:mb-10 text-gray-300">
                      Global Compliance Navigator
                    </p>
                    <h2 className="text-xl sm:text-3xl font-light text-gray-400 text-center max-w-2xl">
                      Ask any question about compliance
                    </h2>

                    <div className="mt-8 sm:mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full max-w-4xl px-2">
                      {/* Sample queries using randomQueries state */}
                      {randomQueries.map((sampleQuery, index) => {
                        let hover = false;
                        return (
                          <div
                            key={index}
                            onClick={() => setQuery(sampleQuery)}
                            onMouseEnter={() => (hover = true)}
                            onMouseLeave={() => (hover = false)}
                            className="bg-zinc-800/60 flex flex-row gap-2 justify-center items-start p-4 sm:p-5 rounded-xl border border-zinc-700/50 hover:border-blue-500/30 shadow-lg cursor-pointer transition-all duration-300"
                          >
                            <div
                              className={`text-blue-400 mb-2 ${
                                hover ? "animate-spin" : "animate-none"
                              }`}
                            >
                              <FaPlus size={16} />
                            </div>
                            <p className="text-gray-300 text-sm">
                              {sampleQuery}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* Show chat messages and skeleton loader if needed */
                  <div className="space-y-8 p-4">
                    {/* Display existing chat messages */}
                    {chatMessages.map((msg, index) => (
                      <div
                        key={index}
                        className="flex w-full font-raleway flex-col justify-between mb-4 border-b border-zinc-800/50 pb-8 animate-fade-in"
                      >
                        <div className="h-full w-full">
                          <h1 className="text-2xl sm:text-3xl font-normal mb-4 mt-4 font-poppins text-zinc-200">
                            {msg.query}
                          </h1>
                          <div className="mb-2 rounded-t-2xl text-lg sm:text-xl mt-2 flex justify-start items-center gap-2">
                            <p className="text-blue-400 text-md animate-pulse">
                              <BsGlobe2 />
                            </p>
                            <span className="text-zinc-300">Answer</span>
                            {selectedChat && index > 0 && (
                              <span
                                className="ml-2 text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full flex items-center gap-1"
                                title="This response uses chat memory"
                              >
                                <FaMemory size={10} /> Memory
                              </span>
                            )}
                          </div>
                          <div className="w-full mt-2 mb-3 overflow-x-auto flex flex-row justify-start gap-2 rounded-lg pb-2">
                            {msg.online_links.map((link, index) => {
                              const meta = metadata[link] || {
                                title: "Loading...",
                                description: "",
                                image: null,
                              };
                              const truncatedTitle =
                                meta.title.length > 15
                                  ? `${meta.title.slice(0, 15)}...`
                                  : meta.title;

                              const domain = new URL(link).hostname;
                              const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

                              return (
                                <a
                                  key={index}
                                  href={link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-200 px-3 py-2 rounded-lg transition-all duration-300 transform hover:scale-105 hover:shadow-lg border border-zinc-700/50 hover:border-blue-400/30 whitespace-nowrap"
                                >
                                  <div className="relative w-5 h-5">
                                    <img
                                      src={faviconUrl}
                                      alt={`${domain} favicon`}
                                      className="w-5 h-5 rounded-full"
                                      onError={(e) => {
                                        e.target.style.display = "none";
                                        e.target.nextSibling.style.display =
                                          "flex";
                                      }}
                                    />
                                    <div className="absolute inset-0 w-5 h-5 rounded-full bg-zinc-700/50 flex items-center justify-center hidden">
                                      <BsGlobe2 className="w-3 h-3 text-zinc-400" />
                                    </div>
                                  </div>
                                  <span className="truncate max-w-[120px] sm:max-w-xs text-xs">
                                    {truncatedTitle}
                                  </span>
                                </a>
                              );
                            })}
                          </div>

                          <div className="bg-zinc-800/50 rounded-lg p-4 sm:p-6 border border-zinc-700/50">
                            <StyledMarkdown content={msg.answer} />
                          </div>

                          <div className="flex flex-row justify-end gap-3 items-center mt-4">
                            <TextToSpeech text={msg.answer} />
                            <button
                              onClick={() => copyToClipboard(msg.answer)}
                              className="text-zinc-400 hover:text-blue-400 transition-colors duration-300"
                            >
                              <FaCopy />
                            </button>
                          </div>

                          <div className="flex flex-col gap-6 mt-6">
                            {/* PDF references section */}
                            <div className="flex-1">
                              <div className="mb-2 text-md flex items-center gap-2">
                                <p className="text-blue-400">
                                  <SiBookstack />
                                </p>
                                <span className="text-zinc-300">
                                  References
                                </span>
                              </div>
                              <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700/50 overflow-x-auto h-full">
                                {Array.isArray(msg.pdf_references) &&
                                msg.pdf_references.length > 0 ? (
                                  <table className="w-full min-w-[500px]">
                                    <thead>
                                      <tr className="text-left border-b border-zinc-700/50">
                                        <th className="pb-3 text-zinc-300">
                                          Document
                                        </th>
                                        <th className="pb-3 text-zinc-300">
                                          Pages
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {msg.pdf_references.map((ref, index) => (
                                        <tr
                                          key={index}
                                          className="border-b border-zinc-700/30"
                                        >
                                          <td className="py-3">
                                            <div className="font-medium text-blue-400">
                                              {ref.name || "Unnamed Document"}
                                            </div>
                                          </td>
                                          <td className="py-3">
                                            <div className="flex flex-wrap gap-2">
                                              {ref.page_number
                                                ?.sort((a, b) => a - b)
                                                .map((page) => (
                                                  <a
                                                    key={page}
                                                    href={`${API_BASE_URL}/pdf?name=${encodeURIComponent(
                                                      ref.name
                                                    )}&userId=${userId}#page=${page}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="px-3 py-1 bg-zinc-700/50 hover:bg-blue-500/20 rounded-md hover:text-blue-400 transition-all duration-300 cursor-pointer border border-zinc-600/50 hover:border-blue-400/30"
                                                  >
                                                    {page}
                                                  </a>
                                                ))}
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  <div className="text-center py-4 text-gray-400">
                                    No document references found for this query
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Related queries section */}
                            <div className="flex-1">
                              <div className="mb-2 text-md flex items-center gap-2">
                                <p className="text-blue-400">
                                  <SiBookstack />
                                </p>
                                <span className="text-zinc-300">Related</span>
                              </div>
                              <div className="border-b border-zinc-700/50 bg-zinc-800/50 rounded-lg p-4 border border-zinc-700/50 h-full">
                                {msg.relevant_queries &&
                                  msg.relevant_queries.map((item, index) => (
                                    <button
                                      key={index}
                                      onClick={() =>
                                        setQuery(
                                          typeof item === "object"
                                            ? item.query
                                            : item
                                        )
                                      }
                                      className="w-full flex flex-between items-center pt-3 pb-3 border-t border-zinc-700/30 hover:text-blue-400 transition-colors duration-300"
                                    >
                                      <div className="text-left w-full">
                                        <p className="text-zinc-300 text-sm sm:text-base">
                                          {typeof item === "object"
                                            ? item.query
                                            : item}
                                        </p>
                                        {typeof item === "object" &&
                                          item.context &&
                                          item.context !==
                                            "Generated suggestion" && (
                                            <p className="text-xs text-zinc-500 mt-1">
                                              {item.context}
                                            </p>
                                          )}
                                      </div>
                                      <AiOutlinePlus className="text-blue-400" />
                                    </button>
                                  ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Show skeleton loader below existing messages when loading */}
                    {showSkeleton && (
                      <div className="mb-8 animate-fade-in">
                        <QueryResultSkeleton />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <form
              onSubmit={handleSubmit}
              className="flex mx-auto border border-blue-400/20 rounded-xl relative bg-zinc-900/50 backdrop-blur-sm shadow-lg shadow-blue-500/5 hover:shadow-blue-500/10 transition-all duration-300 -translate-y-2 relative"
            >
              {error && (
                <div className="absolute -top-10 left-0 right-0 bg-red-500/90 text-white p-2 rounded-md text-sm shadow-lg border border-red-600">
                  {error}
                  <button
                    className="absolute top-2 right-2 text-white"
                    onClick={() => setError(null)}
                  >
                    ✕
                  </button>
                </div>
              )}
              <div className="flex-grow flex items-center px-4 py-2">
                <textarea
                  ref={textareaRef}
                  value={query}
                  onChange={handleQueryChange}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  placeholder={
                    loading
                      ? "Processing your query..."
                      : "Ask anything about compliance... (Use @ to mention products)"
                  }
                  className={`w-full bg-transparent focus:outline-none focus:ring-0 min-h-[48px] max-h-[48px] resize-none text-zinc-200 placeholder-zinc-500 text-sm sm:text-base leading-relaxed ${
                    loading ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  rows={1}
                  style={{
                    height: "48px",
                    lineHeight: "48px",
                    padding: "0",
                  }}
                />
              </div>

              {showSuggestions && filteredProducts.length > 0 && !loading && (
                <div className="absolute bottom-full left-0 mb-2 w-72 bg-zinc-900/95 backdrop-blur-sm rounded-xl shadow-xl border border-blue-400/20 max-h-64 overflow-y-auto custom-scrollbar">
                  {filteredProducts.map((product, index) => (
                    <div
                      key={product.id}
                      className={`p-3 hover:bg-zinc-800/50 cursor-pointer transition-all duration-300 ${
                        index === suggestionIndex ? "bg-zinc-800/50" : ""
                      }`}
                      style={{
                        borderLeft: `4px solid var(--${product.color}-500)`,
                      }}
                      onClick={() => insertProduct(product)}
                      onMouseEnter={() => setSuggestionIndex(index)}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full animate-pulse"
                          style={{
                            backgroundColor: `var(--${product.color}-500)`,
                          }}
                        />
                        <div className="font-medium text-blue-400">
                          {product.title}
                        </div>
                      </div>
                      <div className="text-xs text-zinc-400 truncate pl-4 mt-1">
                        {product.info}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1 pr-2">
                <SpeechToText
                  onTranscriptChange={handleTranscriptChange}
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className={`p-2 bg-blue-500/10 hover:bg-blue-500/20 text-white rounded-lg transition-all duration-300 border border-blue-400/20 hover:border-blue-400/30 ${
                    loading ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {loading ? (
                    <FaSpinner className="animate-spin w-5 h-5 text-blue-400" />
                  ) : (
                    <FaPaperPlane className="w-5 h-5 text-blue-400 hover:scale-110 transition-transform" />
                  )}
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onProductSelect={(product) => {
          setQuery((prev) => prev + ` @${product.title} `);
          setIsProductModalOpen(false);
        }}
      />
      <DocumentModal
        isOpen={isDocumentModalOpen}
        onClose={() => setIsDocumentModalOpen(false)}
      />
    </div>
  );
};

export default Home;
