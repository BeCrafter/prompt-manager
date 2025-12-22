#!/bin/bash

# 设置 npm 镜像源
echo "Setting npm registry to https://registry.npmmirror.com"
npm config set registry https://registry.npmmirror.com

# 安装 app/desktop 依赖
echo "Installing dependencies for app/desktop..."
cd app/desktop
npm install
cd -

# 安装 packages/admin-ui 依赖
echo "Installing dependencies for packages/admin-ui..."
cd packages/admin-ui
npm install
cd -

# 清理缓存
echo "Cleaning up cache..."
rm -rf ~/Library/Application\ Support/@becrafter/prompt-desktop/prompt-manager

if [ "$1" != "dev" ]; then
  # 构建 admin-ui
  echo "Building admin-ui..."
  npm run admin:build
fi

# 构建根目录环境
echo "Building root environment..."
npm install

# 根据参数执行 desktop 构建
echo "Building desktop app..."
case "$1" in
  "dev")
    npm run dev --prefix app/desktop
    ;;
  "build:all")
    npm run build --prefix app/desktop -- --mac --win --linux
    ;;
  "build:mac")
    npm run build --prefix app/desktop -- --mac
    ;;
  "build:win")
    npm run build --prefix app/desktop -- --win
    ;;
  "build:linux")
    npm run build --prefix app/desktop -- --linux
    ;;
  *)
    npm run build --prefix app/desktop
    ;;
esac

# 打印构建完成时间
echo -e "\nBuild completed! \n\nTime: $(date +'%Y-%m-%d %H:%M:%S')"