function EnergyBar() {
    return (
        <div className="absolute bottom-4 left-4 w-64">

            <div className="text-sm mb-1">Energy</div>

            <div className="h-3 bg-gray-700 rounded">
                <div className="h-3 bg-yellow-400 w-1/2 rounded"></div>
            </div>

        </div>
    )
}

export default EnergyBar