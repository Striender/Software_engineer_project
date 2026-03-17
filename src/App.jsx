import { Routes, Route } from "react-router-dom"
import Loading from "./pages/Loading"
import Home from "./pages/Home"
import Game from "./pages/Game"

function App() {
  return (
    <Routes>
      <Route path="/" element={<Loading />} />
      <Route path="/home" element={<Home />} />
      <Route path="/game" element={<Game />} />
    </Routes>
  )
}

export default App