import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  FiUpload,
  FiSearch,
  FiTrash2,
  FiEdit2,
  FiX,
  FiFile,
  FiDownload,
  FiInfo,
  FiEye,
  FiEyeOff,
  FiPlus,
  FiMinus,
  FiRefreshCw,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { toast } from "react-hot-toast";
import { API_BASE_URL } from "../config";

function DocumentModal({ isOpen, onClose }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [documents, setDocuments] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [editInfo, setEditInfo] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [sortOrder, setSortOrder] = useState("newest");
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [expandedDocs, setExpandedDocs] = useState({});
  const [completedUploads, setCompletedUploads] = useState(new Set());
  const [failedUploads, setFailedUploads] = useState(new Set());
  const [userId, setUserId] = useState(null);
  const uploadTimeoutRef = useRef(null);

  // Get userId from localStorage when component mounts
  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    if (storedUserId) {
      setUserId(storedUserId);
    } else {
      toast.error("Authentication required");
    }
  }, []);

  // Debounced search function
  const debouncedSearch = useCallback((query) => {
    if (uploadTimeoutRef.current) {
      clearTimeout(uploadTimeoutRef.current);
    }
    uploadTimeoutRef.current = setTimeout(() => {
      fetchDocuments(query);
    }, 300);
  }, []);

  useEffect(() => {
    if (isOpen && userId) {
      fetchDocuments();
    }
    return () => {
      if (uploadTimeoutRef.current) {
        clearTimeout(uploadTimeoutRef.current);
      }
    };
  }, [isOpen, userId]);

  useEffect(() => {
    if (userId) {
      debouncedSearch(searchQuery);
    }
  }, [searchQuery, debouncedSearch, userId]);

  const fetchDocuments = async (query = searchQuery) => {
    try {
      setIsLoading(true);

      if (!userId) {
        toast.error("Authentication required");
        return;
      }

      const response = await axios.get(
        `${API_BASE_URL}/search-pdfs${
          query ? `?search_query=${query}&` : "?"
        }userId=${userId}`,
        {
          timeout: 30000, // 30 second timeout
          headers: {
            Accept: "application/json",
          },
        }
      );

      // Check if response.data has the expected structure
      // If not, use an empty array as fallback
      if (response.data && Array.isArray(response.data.results)) {
        setDocuments(response.data.results);
      } else if (Array.isArray(response.data)) {
        // Handle case where API returns array directly
        setDocuments(response.data);
      } else {
        console.error("Unexpected response format:", response.data);
        setDocuments([]);
      }
    } catch (error) {
      // Handle different error types
      let errorMessage = "Failed to fetch documents";

      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        errorMessage = `Server error: ${error.response.status}`;
        console.error("Error response:", error.response.data);
      } else if (error.request) {
        // The request was made but no response was received
        errorMessage = "No response from server";
      } else {
        // Something happened in setting up the request that triggered an Error
        errorMessage = `Request error: ${error.message}`;
      }

      toast.error(errorMessage);
      console.error("Error fetching documents:", error);
      setDocuments([]); // Set to empty array on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    const validFiles = files.filter((file) => file.type === "application/pdf");

    if (validFiles.length !== files.length) {
      toast.error("Some files were skipped. Only PDF files are allowed.");
    }

    setSelectedFiles((prev) => [...prev, ...validFiles]);
    setCompletedUploads(new Set());
    setFailedUploads(new Set());
  };

  const removeFileFromQueue = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setCompletedUploads((prev) => {
      const newSet = new Set(prev);
      newSet.delete(selectedFiles[index].name);
      return newSet;
    });
    setFailedUploads((prev) => {
      const newSet = new Set(prev);
      newSet.delete(selectedFiles[index].name);
      return newSet;
    });
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    if (!userId) {
      toast.error("Authentication required");
      return;
    }

    setIsUploading(true);
    const queue = [...selectedFiles];
    setUploadQueue(queue);
    setUploadProgress({});
    setCompletedUploads(new Set());
    setFailedUploads(new Set());

    for (let i = 0; i < queue.length; i++) {
      const file = queue[i];
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", userId);

      try {
        await axios.post(`${API_BASE_URL}/upload-pdf`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
            Accept: "application/json",
          },
          timeout: 60000, // 60 second timeout for uploads
          onUploadProgress: (progressEvent) => {
            const progress = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress((prev) => ({
              ...prev,
              [file.name]: progress,
            }));
          },
        });
        setCompletedUploads((prev) => new Set([...prev, file.name]));
        toast.success(`Successfully uploaded: ${file.name}`);
      } catch (error) {
        setFailedUploads((prev) => new Set([...prev, file.name]));

        // Handle different error types
        let errorMessage = `Failed to upload: ${file.name}`;

        if (error.response) {
          errorMessage += ` - Server error: ${error.response.status}`;
          console.error("Error response:", error.response.data);
        } else if (error.request) {
          errorMessage += " - No response from server";
        } else {
          errorMessage += ` - ${error.message}`;
        }

        toast.error(errorMessage);
        console.error("Error uploading document:", error);
      }
    }

    // Refresh document list after all uploads
    await fetchDocuments();

    setSelectedFiles([]);
    setUploadQueue([]);
    setUploadProgress({});
    setIsUploading(false);
  };

  const handleDelete = async (pdfName) => {
    if (window.confirm("Are you sure you want to delete this document?")) {
      try {
        if (!userId) {
          toast.error("Authentication required");
          return;
        }

        await axios.delete(
          `${API_BASE_URL}/delete-pdf/${pdfName}?userId=${userId}`,
          {
            timeout: 30000,
            headers: {
              Accept: "application/json",
            },
          }
        );
        toast.success("Document deleted successfully");
        fetchDocuments();
      } catch (error) {
        // Handle different error types
        let errorMessage = "Failed to delete document";

        if (error.response) {
          errorMessage += ` - Server error: ${error.response.status}`;
          console.error("Error response:", error.response.data);
        } else if (error.request) {
          errorMessage += " - No response from server";
        } else {
          errorMessage += ` - ${error.message}`;
        }

        toast.error(errorMessage);
        console.error("Error deleting document:", error);
      }
    }
  };

  const handleEdit = async (pdfName) => {
    try {
      if (!userId) {
        toast.error("Authentication required");
        return;
      }

      await axios.put(
        `${API_BASE_URL}/update-pdf-info/${pdfName}?userId=${userId}`,
        {
          new_info: editInfo,
        },
        {
          timeout: 30000,
          headers: {
            Accept: "application/json",
          },
        }
      );
      toast.success("Document updated successfully");
      setEditingDoc(null);
      setEditInfo("");
      fetchDocuments();
    } catch (error) {
      // Handle different error types
      let errorMessage = "Failed to update document";

      if (error.response) {
        errorMessage += ` - Server error: ${error.response.status}`;
        console.error("Error response:", error.response.data);
      } else if (error.request) {
        errorMessage += " - No response from server";
      } else {
        errorMessage += ` - ${error.message}`;
      }

      toast.error(errorMessage);
      console.error("Error updating document:", error);
    }
  };

  const handleDownload = async (pdfName) => {
    try {
      if (!userId) {
        toast.error("Authentication required");
        return;
      }

      const response = await axios.get(
        `${API_BASE_URL}/pdf?name=${pdfName}&userId=${userId}`,
        {
          responseType: "blob",
          timeout: 30000,
        }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${pdfName}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      // Handle different error types
      let errorMessage = "Failed to download document";

      if (error.response) {
        errorMessage += ` - Server error: ${error.response.status}`;
      } else if (error.request) {
        errorMessage += " - No response from server";
      } else {
        errorMessage += ` - ${error.message}`;
      }

      toast.error(errorMessage);
      console.error("Error downloading document:", error);
    }
  };

  const sortedDocuments = useCallback(() => {
    // Ensure documents is an array before spreading
    if (!Array.isArray(documents)) return [];

    return [...documents].sort((a, b) => {
      if (sortOrder === "newest") return b.name.localeCompare(a.name);
      if (sortOrder === "oldest") return a.name.localeCompare(b.name);
      return 0;
    });
  }, [documents, sortOrder]);

  const toggleDocInfo = (docName) => {
    setExpandedDocs((prev) => ({
      ...prev,
      [docName]: !prev[docName],
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-zinc-800/95 backdrop-blur-md rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-blue-400/30 shadow-xl"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-white font-poppins">
            Document Management
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors duration-300"
          >
            <FiX size={24} />
          </button>
        </div>

        {/* Upload Section */}
        <div className="mb-6 p-4 bg-zinc-700/30 rounded-lg border border-blue-400/20">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-white font-poppins">
              Upload Documents
            </h3>
            <button
              onClick={() => fetchDocuments()}
              className="p-2 text-zinc-400 hover:text-white transition-colors duration-300"
              title="Refresh documents"
            >
              <FiRefreshCw className={`${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  multiple
                  className="w-full p-2 bg-zinc-800/50 border border-blue-400/30 rounded-lg text-zinc-300 placeholder-zinc-500 focus:outline-none focus:border-blue-400/50 transition-all duration-300"
                />
              </div>
              <button
                onClick={handleUpload}
                disabled={selectedFiles.length === 0 || isUploading}
                className="px-4 py-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 disabled:opacity-50 flex items-center gap-2 border border-blue-400/30 hover:border-blue-400/50 transition-all duration-300"
              >
                <FiUpload className="group-hover:scale-110 transition-transform" />
                {isUploading ? "Uploading..." : "Upload All"}
              </button>
            </div>

            {/* Upload Queue */}
            {selectedFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className="text-sm font-medium text-zinc-300">
                  Selected Files:
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className={`flex items-center justify-between p-2 rounded-lg border transition-all duration-300 ${
                        completedUploads.has(file.name)
                          ? "bg-green-500/10 border-green-400/30"
                          : failedUploads.has(file.name)
                          ? "bg-red-500/10 border-red-400/30"
                          : "bg-zinc-800/50 border-blue-400/20"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <FiFile
                          className={
                            completedUploads.has(file.name)
                              ? "text-green-400"
                              : failedUploads.has(file.name)
                              ? "text-red-400"
                              : "text-blue-400"
                          }
                        />
                        <span className="text-sm text-zinc-300 truncate max-w-[300px]">
                          {file.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {uploadProgress[file.name] !== undefined && (
                          <div className="w-20 bg-zinc-700/50 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full transition-all duration-300 ${
                                completedUploads.has(file.name)
                                  ? "bg-green-400"
                                  : failedUploads.has(file.name)
                                  ? "bg-red-400"
                                  : "bg-blue-400"
                              }`}
                              style={{ width: `${uploadProgress[file.name]}%` }}
                            />
                          </div>
                        )}
                        <button
                          onClick={() => removeFileFromQueue(index)}
                          className="p-1 text-zinc-400 hover:text-red-400 transition-colors duration-300"
                          title="Remove from queue"
                        >
                          <FiMinus size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload Progress */}
            {isUploading && uploadQueue.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-zinc-300 mb-2">
                  Upload Progress:
                </h4>
                <div className="space-y-2">
                  {uploadQueue.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-400 truncate max-w-[300px]">
                          {file.name}
                        </span>
                        <span className="text-zinc-400">
                          {uploadProgress[file.name] || 0}%
                        </span>
                      </div>
                      <div className="w-full bg-zinc-700/50 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            completedUploads.has(file.name)
                              ? "bg-green-400"
                              : failedUploads.has(file.name)
                              ? "bg-red-400"
                              : "bg-blue-400"
                          }`}
                          style={{
                            width: `${uploadProgress[file.name] || 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Search and Sort Section */}
        <div className="mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-2 pl-10 bg-zinc-800/50 border border-blue-400/30 rounded-lg text-zinc-300 placeholder-zinc-500 focus:outline-none focus:border-blue-400/50 transition-all duration-300"
              />
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400" />
            </div>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="p-2 bg-zinc-800/50 border border-blue-400/30 rounded-lg text-zinc-300 focus:outline-none focus:border-blue-400/50 transition-all duration-300"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
            <button
              onClick={fetchDocuments}
              className="px-4 py-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 flex items-center gap-2 border border-blue-400/30 hover:border-blue-400/50 transition-all duration-300"
            >
              <FiSearch className="group-hover:scale-110 transition-transform" />
              Search
            </button>
          </div>
        </div>

        {/* Documents List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
            </div>
          ) : sortedDocuments().length === 0 ? (
            <div className="text-center py-8 text-zinc-400">
              No documents found
            </div>
          ) : (
            sortedDocuments().map((doc) => (
              <motion.div
                key={doc.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-zinc-700/30 rounded-lg border border-blue-400/20 hover:bg-zinc-700/50 transition-all duration-300"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <FiFile className="text-blue-400" />
                      <h4 className="font-medium text-white font-poppins">
                        {doc.name}
                      </h4>
                      <button
                        onClick={() => toggleDocInfo(doc.name)}
                        className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors duration-300"
                        title={
                          expandedDocs[doc.name]
                            ? "Hide details"
                            : "Show details"
                        }
                      >
                        {expandedDocs[doc.name] ? (
                          <FiEyeOff size={16} />
                        ) : (
                          <FiEye size={16} />
                        )}
                      </button>
                    </div>
                    <AnimatePresence>
                      {expandedDocs[doc.name] && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          {editingDoc === doc.name ? (
                            <div className="mt-2">
                              <textarea
                                value={editInfo}
                                onChange={(e) => setEditInfo(e.target.value)}
                                className="w-full p-2 bg-zinc-800/50 border border-blue-400/30 rounded-lg text-zinc-300 placeholder-zinc-500 focus:outline-none focus:border-blue-400/50 transition-all duration-300"
                                rows={3}
                              />
                              <div className="mt-2 flex gap-2">
                                <button
                                  onClick={() => handleEdit(doc.name)}
                                  className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 border border-blue-400/30 hover:border-blue-400/50 transition-all duration-300"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingDoc(null);
                                    setEditInfo("");
                                  }}
                                  className="px-3 py-1 bg-zinc-700/50 text-zinc-300 rounded-lg hover:bg-zinc-700/70 border border-zinc-600/50 hover:border-zinc-500/50 transition-all duration-300"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-2 p-3 bg-zinc-800/30 rounded-lg border border-blue-400/10">
                              <p className="text-zinc-400">{doc.info}</p>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDownload(doc.name)}
                      className="p-2 text-green-400 hover:text-green-300 transition-colors duration-300"
                      title="Download"
                    >
                      <FiDownload />
                    </button>
                    <button
                      onClick={() => {
                        setEditingDoc(doc.name);
                        setEditInfo(doc.info);
                      }}
                      className="p-2 text-blue-400 hover:text-blue-300 transition-colors duration-300"
                      title="Edit"
                    >
                      <FiEdit2 />
                    </button>
                    <button
                      onClick={() => handleDelete(doc.name)}
                      className="p-2 text-red-400 hover:text-red-300 transition-colors duration-300"
                      title="Delete"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default DocumentModal;
