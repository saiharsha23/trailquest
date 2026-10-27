import {Routes,Route} from "react-router-dom";import Landing from "./pages/Landing";import AdminApp from "./admin/AdminApp";import PlayApp from "./play/PlayApp";
export default function App(){return <Routes><Route path="/admin/*" element={<AdminApp/>}/><Route path="/play" element={<PlayApp/>}/><Route path="*" element={<Landing/>}/></Routes>}
