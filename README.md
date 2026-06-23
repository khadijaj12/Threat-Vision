# Threat-Vision
Real-time intruder detection and threat segmentation system using YOLOv8, U-Net, and MobileNetV3 — deployed on GPU with live React dashboard.
ThreatVision AI is an end-to-end real-time surveillance system 
that detects intruders, segments threat regions pixel-by-pixel, 
and instantly clears the threat area in the video feed while 
blurring the background.

Two-stage pipeline:
→ Stage 1: YOLOv8n detects persons and weapons every frame (<10ms)
→ Stage 2: MobileNetV3 violence classifier triggers on positives
→ U-Net ResNet34 segments the threat region and applies video clearing

Features:
- 8.5ms pipeline latency on T4 GPU
- Live WebSocket video streaming
- React dashboard with real-time alert logging
- REST API built with FastAPI
- Docker ready for cloud deployment

Stack: YOLOv8 · U-Net · MobileNetV3 · FastAPI · 
       React · WebSocket · Docker · PyTorch · COCO
