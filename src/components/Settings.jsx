function Settings({ isOpen, onClose }) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center">

            <div className="bg-gray-900 p-6 rounded-xl w-80 border border-gray-700">

                <h2 className="text-xl mb-4">Settings</h2>

                <button className="mb-3 w-full">🔊 Sound</button>
                <button className="mb-3 w-full">🌙 Theme</button>

                <button
                    onClick={onClose}
                    className="mt-4 w-full bg-red-600 py-2 rounded"
                >
                    Close
                </button>

            </div>
        </div>
    )
}

export default Settings