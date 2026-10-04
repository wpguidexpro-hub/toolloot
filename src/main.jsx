import { createRoot } from "react-dom/client";
import SpaceGame from "./SpaceGame.jsx";
import "./chat.css";
createRoot(document.getElementById("root")).render(<SpaceGame onBack={()=>location.reload()}/>);