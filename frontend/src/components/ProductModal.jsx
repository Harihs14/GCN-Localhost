import React, { useState, useEffect } from "react";
import { FaPlus, FaTrash, FaEdit, FaCheck } from "react-icons/fa";
import { API_BASE_URL } from "../config";

const ProductModal = ({ isOpen, onClose, onProductSelect }) => {
  const [products, setProducts] = useState([]);
  const [newProduct, setNewProduct] = useState({
    title: "",
    info: "",
    color: "blue",
  });
  const [editingProduct, setEditingProduct] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [userId, setUserId] = useState(null);

  const colors = ["red", "purple", "orange", "green", "blue", "white"];

  useEffect(() => {
    // Get userId from localStorage
    const storedUserId = localStorage.getItem("userId");
    if (storedUserId) {
      setUserId(storedUserId);
    }
  }, []);

  useEffect(() => {
    if (userId) {
      fetchProducts();
    }
  }, [userId]);

  const fetchProducts = async () => {
    try {
      if (!userId) {
        console.error("User ID is required");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/products?userId=${userId}`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to fetch products: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json();
      setProducts(data);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!userId) {
        console.error("User ID is required");
        return;
      }

      const url = editingProduct
        ? `${API_BASE_URL}/products/${editingProduct.id}`
        : `${API_BASE_URL}/products`;

      const method = editingProduct ? "PUT" : "POST";
      const productData = editingProduct || newProduct;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: productData.title,
          info: productData.info,
          color: productData.color,
          userId: userId,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to save product: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      await response.json();
      fetchProducts();
      setNewProduct({ title: "", info: "", color: "blue" });
      setEditingProduct(null);
      setShowColorPicker(false);
    } catch (error) {
      console.error("Error saving product:", error);
    }
  };

  const deleteProduct = async (id) => {
    try {
      if (!userId) {
        console.error("User ID is required");
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/products/${id}?userId=${userId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to delete product: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      fetchProducts();
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  };

  const ColorPicker = ({ selectedColor, onColorSelect }) => (
    <div className="absolute w-30 right-0 top-full mt-2 bg-zinc-800 p-2 rounded-lg shadow-lg border border-zinc-600 z-50">
      <div className="grid grid-cols-3 gap-2">
        {colors.map((color) => (
          <button
            key={color}
            onClick={() => {
              onColorSelect(color);
              setTimeout(() => {
                setShowColorPicker(false);
              }, 100);
            }}
            className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
              selectedColor === color ? "border-white" : "border-transparent"
            }`}
            style={{ backgroundColor: `var(--${color}-500)` }}
          >
            {selectedColor === color && (
              <FaCheck className="text-white text-sm" />
            )}
          </button>
        ))}
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-transparent backdrop-blur-md flex items-center justify-center z-50">
      <div className="bg-zinc-800 p-6 rounded-lg w-[600px] max-h-[80vh] overflow-y-auto">
        <h2 className="text-2xl text-blue-400 mb-4">Product Management</h2>

        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex gap-4 mb-2">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Product Title"
                value={editingProduct?.title || newProduct.title}
                onChange={(e) =>
                  editingProduct
                    ? setEditingProduct({
                        ...editingProduct,
                        title: e.target.value,
                      })
                    : setNewProduct({ ...newProduct, title: e.target.value })
                }
                className="w-full p-2 bg-zinc-700 rounded"
              />
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="w-10 h-10 rounded-full border-2 border-white"
                style={{
                  backgroundColor: `var(--${
                    editingProduct?.color || newProduct.color
                  }-500)`,
                }}
              />
              {showColorPicker && (
                <ColorPicker
                  selectedColor={editingProduct?.color || newProduct.color}
                  onColorSelect={(color) =>
                    editingProduct
                      ? setEditingProduct({ ...editingProduct, color })
                      : setNewProduct({ ...newProduct, color })
                  }
                />
              )}
            </div>
          </div>

          <textarea
            placeholder="Product Information"
            value={editingProduct?.info || newProduct.info}
            onChange={(e) =>
              editingProduct
                ? setEditingProduct({ ...editingProduct, info: e.target.value })
                : setNewProduct({ ...newProduct, info: e.target.value })
            }
            className="w-full p-2 mb-2 bg-zinc-700 rounded h-32"
          />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-600 rounded"
            >
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-blue-500 rounded">
              {editingProduct ? "Update" : "Add"} Product
            </button>
          </div>
        </form>

        <div className="space-y-2">
          {products.map((product) => (
            <div
              key={product.id}
              className={`flex items-center justify-between bg-zinc-700 p-3 rounded border-l-4 border-${product.color}-500`}
              style={{ borderColor: `var(--${product.color}-500)` }}
            >
              <div className="flex-1 flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full animate-pulse"
                  style={{ backgroundColor: `var(--${product.color}-500)` }}
                />
                <div>
                  <h3 className="font-semibold text-blue-400">
                    {product.title}
                  </h3>
                  <p className="text-sm text-gray-300">
                    {`${product.info.split(/\s+/).slice(0, 50).join(" ")}${
                      product.info.split(/\s+/).length > 50 ? "..." : ""
                    }`}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingProduct(product)}
                  className="p-2 text-yellow-400 hover:bg-zinc-600 rounded"
                >
                  <FaEdit />
                </button>
                <button
                  onClick={() => deleteProduct(product.id)}
                  className="p-2 text-red-400 hover:bg-zinc-600 rounded"
                >
                  <FaTrash />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProductModal;
