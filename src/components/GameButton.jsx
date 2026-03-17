function GameButton({ text, onClick }) {
    return (
        <button
            onClick={onClick}
            className="w-64 py-3 text-lg rounded-xl glow-btn tracking-wider"
        >
            {text}
        </button>
    )
}

export default GameButton