import { useNavigate } from "react-router-dom"
import { useState } from "react"
import GameButton from "../components/GameButton"
import Profile from "../components/Profile"
import Stats from "../components/Stats"
import Settings from "../components/Settings"

function Home() {
    const navigate = useNavigate()
    const [openSettings, setOpenSettings] = useState(false)

    return (
        <div className="h-screen flex flex-col justify-between p-6">

            {/* TOP BAR */}
            <div className="flex justify-between items-center">
                <Stats />
                <Profile />
            </div>

            {/* CENTER CHARACTER */}
            <div className="flex flex-col items-center">

                <div className="relative">
                    <div className="absolute inset-0 blur-3xl bg-red-600 opacity-30 rounded-full"></div>

                    <div className="w-56 h-56 bg-gray-800 rounded-xl flex items-center justify-center">
                        Character
                    </div>
                </div>

                <h2 className="mt-4 text-lg text-gray-400">Shadow Fighter</h2>
            </div>

            {/* MENU BUTTONS */}
            <div className="flex flex-col items-center gap-4 mb-10">

                <GameButton text="⚔️ Start Game" onClick={() => navigate("/game")} />
                <GameButton text="🌐 Multiplayer" />
                <GameButton text="🎯 Training" />

                <button
                    onClick={() => setOpenSettings(true)}
                    className="text-gray-400 hover:text-white"
                >
                    ⚙️ Settings
                </button>

            </div>

            {/* SETTINGS MODAL */}
            <Settings
                isOpen={openSettings}
                onClose={() => setOpenSettings(false)}
            />

        </div>
    )
}

export default Home