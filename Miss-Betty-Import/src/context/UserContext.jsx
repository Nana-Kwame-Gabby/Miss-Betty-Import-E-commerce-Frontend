import { createContext, useContext } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const { session } = useAuth();

  const user = {
    fullName: session?.user?.user_metadata?.full_name ?? "",
    email: session?.user?.email ?? "",
    phone: session?.user?.user_metadata?.phone ?? "",
  };

  async function updatePhone(newPhone) {
    await supabase.auth.updateUser({ data: { phone: newPhone } });
    if (session?.user?.id) {
      await supabase
        .from("customers")
        .update({ telephone: newPhone })
        .eq("auth_id", session.user.id);
    }
  }

  return (
    <UserContext.Provider value={{ user, updatePhone }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
