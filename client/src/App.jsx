import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        {/* We use an inline player now, so the separate watch page is no longer needed */}
      </Routes>
    </BrowserRouter>
  )
}
