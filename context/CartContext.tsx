"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  type CartItem,
  fetchUserCart,
  upsertCartItem,
  deleteCartItem,
  clearUserCart,
  subscribeUserCart,
} from "@/lib/storefront/cart";

export type { CartItem };

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: CartItem) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  calculateTotal: () => string;
  clearCart: () => void;
  isCartSyncing: boolean;
  cartLoading: boolean;
  removeFromCartByIds: (ids: (number | string)[]) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartSyncing, setIsCartSyncing] = useState(false);
  const [cartLoading, setCartLoading] = useState(true);
  const { toast } = useToast();
  const addedItemRef = useRef<CartItem | null>(null);

  const loadCart = useCallback(async () => {
    if (!user) {
      setCartItems([]);
      setCartLoading(false);
      return;
    }
    try {
      setCartItems(await fetchUserCart(user.uid));
    } catch (err) {
      console.error("Failed to load cart:", err);
      setCartItems([]);
    } finally {
      setCartLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const onAdmin =
      typeof window !== "undefined" &&
      window.location.pathname.startsWith("/admin");
    if (onAdmin) {
      setCartItems([]);
      setCartLoading(false);
      return;
    }

    if (!user) {
      setCartItems([]);
      setCartLoading(false);
      return;
    }

    setCartLoading(true);
    void loadCart();
    const unsubscribe = subscribeUserCart(user.uid, () => {
      void loadCart();
    });
    return unsubscribe;
  }, [user, loadCart]);

  const calculateTotal = () => {
    return cartItems
      .reduce((total, item) => {
        const price =
          typeof item.price === "string"
            ? parseFloat(item.price.replace(/[^\d.]/g, ""))
            : Number(item.price);
        return total + price * item.quantity;
      }, 0)
      .toFixed(2);
  };

  const addToCart = (productToAdd: CartItem) => {
    addedItemRef.current = null;
    setCartItems((prevItems) => {
      const existingItem = prevItems.find(
        (item) =>
          item.id === productToAdd.id &&
          item.selectedSize === productToAdd.selectedSize
      );
      const quantity = existingItem
        ? existingItem.quantity + productToAdd.quantity
        : productToAdd.quantity || 1;

      const newItems = existingItem
        ? prevItems.map((item) =>
            item.id === productToAdd.id &&
            item.selectedSize === productToAdd.selectedSize
              ? { ...item, quantity }
              : item
          )
        : [...prevItems, { ...productToAdd, quantity }];

      addedItemRef.current = { ...productToAdd, quantity };

      if (user) {
        setIsCartSyncing(true);
        void upsertCartItem(user.uid, productToAdd, quantity)
          .catch((err) => console.error("[addToCart]", err))
          .finally(() => setIsCartSyncing(false));
      }

      return newItems;
    });

    setTimeout(() => {
      const addedItem = addedItemRef.current;
      if (addedItem) {
        toast({
          title: "Added to cart",
          description: `${addedItem.quantity} ${addedItem.name}${
            addedItem.selectedSize ? ` (${addedItem.selectedSize}` : ""
          }${addedItem.selectedColor ? `, ${addedItem.selectedColor}` : ""}${
            addedItem.selectedSize ? ")" : ""
          } added to cart!`,
          variant: "success",
        });
      }
    }, 0);
  };

  const removeFromCart = (productId: string) => {
    setCartItems((prevItems) => {
      const itemToRemove = prevItems.find((item) => item.id === productId);
      const newItems = prevItems.filter((item) => item.id !== productId);
      if (user && itemToRemove) {
        void deleteCartItem(user.uid, itemToRemove).catch(console.error);
      }
      return newItems;
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    setCartItems((prevItems) => {
      const newItems = prevItems.map((item) =>
        item.id === productId
          ? { ...item, quantity: Math.max(1, quantity) }
          : item
      );
      if (user) {
        const updatedItem = newItems.find((item) => item.id === productId);
        if (updatedItem) {
          void upsertCartItem(user.uid, updatedItem, updatedItem.quantity).catch(
            console.error
          );
        }
      }
      return newItems;
    });
  };

  const clearCart = () => {
    setCartItems([]);
    if (user) {
      void clearUserCart(user.uid).catch(console.error);
    }
  };

  const removeFromCartByIds = (ids: (number | string)[]) => {
    setCartItems((prevItems) => {
      const removed = prevItems.filter((item) => ids.includes(item.id));
      const newItems = prevItems.filter((item) => !ids.includes(item.id));
      if (user) {
        for (const item of removed) {
          void deleteCartItem(user.uid, item).catch(console.error);
        }
      }
      return newItems;
    });
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        calculateTotal,
        clearCart,
        isCartSyncing,
        cartLoading,
        removeFromCartByIds,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
