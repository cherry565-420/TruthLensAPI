document.addEventListener('DOMContentLoaded', () => {
    // Tab Switching
    const tabBtns = document.querySelectorAll('.tab-btn');
    const sections = document.querySelectorAll('.module-section');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class
            tabBtns.forEach(b => b.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));

            // Add active class
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');
            
            // Reset state logically when switching tabs
            resetUI();
        });
    });

    const API_BASE = '';
    
    // State management
    let currentFiles = {
        image: null,
        video: null,
        document: null
    };

    let objectUrls = [];

    // Setup each module
    setupModule('image', 'image-drop', 'image-input', 'image-preview-container', 'image-preview', 'analyze-image-btn', `${API_BASE}/analyze-image`);
    setupModule('video', 'video-drop', 'video-input', 'video-preview-container', 'video-preview', 'analyze-video-btn', `${API_BASE}/analyze-video`);
    setupModule('document', 'document-drop', 'document-input', 'document-preview-container', null, 'analyze-doc-btn', `${API_BASE}/analyze-document`);

    function setupModule(type, dropId, inputId, previewContainerId, previewElementId, btnId, endpoint) {
        const dropArea = document.getElementById(dropId);
        const input = document.getElementById(inputId);
        const browseText = dropArea.querySelector('span');
        const previewContainer = document.getElementById(previewContainerId);
        const analyzeBtn = document.getElementById(btnId);
        
        let previewElement = previewElementId ? document.getElementById(previewElementId) : null;
        const docFileName = document.getElementById('doc-filename');

        // Click to browse
        dropArea.addEventListener('click', () => input.click());

        // Drag and drop events
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => dropArea.classList.add('dragover'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => dropArea.classList.remove('dragover'), false);
        });

        dropArea.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length) handleFile(files[0]);
        });

        input.addEventListener('change', function() {
            if (this.files.length) handleFile(this.files[0]);
        });

        function handleFile(file) {
            // Very basic size validation (e.g., max 50MB)
            if (file.size > 50 * 1024 * 1024) {
                alert("File is too large (max 50MB)");
                return;
            }

            currentFiles[type] = file;
            
            // UI Switch
            dropArea.style.display = 'none';
            previewContainer.style.display = 'flex';
            analyzeBtn.disabled = false;

            // Generate Preview
            if (type === 'image' || type === 'video') {
                const url = URL.createObjectURL(file);
                objectUrls.push(url);
                previewElement.src = url;
            } else if (type === 'document') {
                docFileName.textContent = file.name;
            }
        }

        analyzeBtn.addEventListener('click', () => {
            if (!currentFiles[type]) return;
            startAnalysis(currentFiles[type], endpoint);
        });
    }

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Analysis Logic
    const loadingOverlay = document.getElementById('loading-overlay');
    const progressBar = document.getElementById('progress-bar');
    const scanningText = document.querySelector('.scanning-text');
    
    // Result UI elements
    const resultScreen = document.getElementById('result-screen');
    const resultBadge = document.getElementById('result-badge');
    const confidenceText = document.getElementById('confidence-text');
    const confidenceCircle = document.getElementById('confidence-circle');
    const methodText = document.getElementById('method-text');
    const explanationText = document.getElementById('explanation-text');
    const resetBtn = document.getElementById('reset-btn');

    async function startAnalysis(file, endpoint) {
        // Show loading
        loadingOverlay.style.display = 'flex';
        progressBar.style.width = '0%';
        
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress > 90) progress = 90;
            progressBar.style.width = `${progress}%`;
            
            if (progress < 30) scanningText.textContent = "Extracting Features...";
            else if (progress < 60) scanningText.textContent = "Running Neural Nets...";
            else scanningText.textContent = "Calculating Confidence...";
        }, 400);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(endpoint, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            clearInterval(progressInterval);
            progressBar.style.width = '100%';
            scanningText.textContent = "Analysis Complete!";

            setTimeout(() => {
                showResults(data);
            }, 500);

        } catch (error) {
            clearInterval(progressInterval);
            alert("Error connecting to the TruthLens backend. Please ensure the server is running on port 5005.");
            resetUI();
        }
    }

    function showResults(data) {
        loadingOverlay.style.display = 'none';
        
        // Hide all sections
        document.querySelectorAll('.module-section').forEach(s => s.classList.remove('active'));
        
        // Update Result Screen
        resultScreen.className = 'result-screen'; // reset class
        resultScreen.style.display = 'flex';
        
        const res = data.result.toUpperCase();
        resultBadge.textContent = res;
        
        let themeColor = '';
        if (res === 'REAL') {
            resultScreen.classList.add('result-real');
            themeColor = '#00ff88';
        } else if (res === 'FAKE') {
            resultScreen.classList.add('result-fake');
            themeColor = '#ff3366';
        } else {
            resultScreen.classList.add('result-suspicious');
            themeColor = '#ffb700';
        }

        confidenceText.textContent = `${data.confidence}%`;
        
        // Animate circular progress
        confidenceCircle.style.setProperty('--p', '0%');
        setTimeout(() => {
            confidenceCircle.style.background = `conic-gradient(${themeColor} ${data.confidence}%, #222 ${data.confidence}%)`;
        }, 100);

        methodText.textContent = data.method;
        explanationText.textContent = data.explanation;
    }

    resetBtn.addEventListener('click', () => {
        // Find the currently active tab logically based on which one has 'active' class
        const currentTab = document.querySelector('.tab-btn.active');
        resetUI();
        currentTab.click(); // Re-trigger tab click to show the section
    });

    function resetUI() {
        // Cleanup memory
        objectUrls.forEach(url => URL.revokeObjectURL(url));
        objectUrls = [];

        currentFiles = { image: null, video: null, document: null };

        // Reset Inputs & Views
        const resetModule = (dropId, inputId, previewId, btnId) => {
            document.getElementById(dropId).style.display = 'block';
            document.getElementById(inputId).value = "";
            document.getElementById(previewId).style.display = 'none';
            document.getElementById(btnId).disabled = true;
        };

        resetModule('image-drop', 'image-input', 'image-preview-container', 'analyze-image-btn');
        resetModule('video-drop', 'video-input', 'video-preview-container', 'analyze-video-btn');
        resetModule('document-drop', 'document-input', 'document-preview-container', 'analyze-doc-btn');
        
        document.getElementById('image-preview').src = "";
        document.getElementById('video-preview').src = "";
        
        loadingOverlay.style.display = 'none';
        resultScreen.style.display = 'none';
    }
});
