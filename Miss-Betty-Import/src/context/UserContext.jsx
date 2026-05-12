import { createContext, useContext, useState } from "react";

const mockUser = {
  fullName: "Ama Boateng",
  email: "ama.boateng@example.com",
  phone: "+233 24 123 4567",
};

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(mockUser);

  function updatePhone(phone) {
    setUser(prev => ({ ...prev, phone }));
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
