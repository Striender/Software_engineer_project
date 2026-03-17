function HUD() {
    return (
        <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center">

            {/* Player 1 */}
            <div className="w-1/3">
                <div className="text-sm mb-1">Player 1</div>
                <div className="h-4 bg-gray-700 rounded">
                    <div className="h-4 bg-red-600 w-3/4 rounded"></div>
                </div>
            </div>

            {/* Timer */}
            <div className="text-2xl font-bold">60</div>

            {/* Player 2 */}
            <div className="w-1/3 text-right">
                <div className="text-sm mb-1">Player 2</div>
                <div className="h-4 bg-gray-700 rounded">
                    <div className="h-4 bg-blue-600 w-2/4 rounded ml-auto"></div>
                </div>
            </div>

        </div>
    )
}

export default HUD