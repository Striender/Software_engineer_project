import HUD from "../components/HUD"
import EnergyBar from "../components/EnergyBar"

function Game() {
    return (
        <div className="h-screen bg-black relative text-white">

            <HUD />
            <EnergyBar />

            {/* Game Area */}
            <div className="flex justify-center items-center h-full">
                <h1 className="text-3xl">Fight Arena</h1>
            </div>

        </div>
    )
}

export default Game